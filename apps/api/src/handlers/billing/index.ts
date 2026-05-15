import { autumnHandler } from "autumn-js/backend";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { Resource } from "sst/resource/cloudflare";

import type { Contract } from "@leuchtturm/api/contract";
import { Observability } from "@leuchtturm/api/observability";
import { Auth } from "@leuchtturm/core/auth";
import { InternalServerError } from "@leuchtturm/core/errors";

export namespace BillingHandler {
	export const handlePassthrough = Effect.fn("BillingHandler.handlePassthrough")(function* (
		request: HttpServerRequest.HttpServerRequest,
	) {
		const auth = yield* Auth.Service;
		const source = request.source as Request;
		const headers = new Headers(request.headers as Record<string, string>);

		yield* auth
			.getSession(headers)
			.pipe(
				Effect.flatMap((session) =>
					session
						? Effect.succeed(session)
						: Effect.fail(
								HttpServerResponse.fromWeb(
									Response.json({ message: "Unauthorized." }, { status: 401 }),
								),
							),
				),
			);
		const organizationId = yield* Effect.succeed(headers.get("x-organization-id")).pipe(
			Effect.flatMap((organizationId) =>
				organizationId
					? Effect.succeed(organizationId)
					: Effect.fail(
							HttpServerResponse.fromWeb(Response.json({ message: "Forbidden." }, { status: 403 })),
						),
			),
		);
		const organization = yield* auth
			.getOrganization(headers, organizationId)
			.pipe(
				Effect.flatMap((organization) =>
					organization
						? Effect.succeed(organization)
						: Effect.fail(
								HttpServerResponse.fromWeb(
									Response.json({ message: "Forbidden." }, { status: 403 }),
								),
							),
				),
			);

		const result = yield* Effect.tryPromise({
			try: async () =>
				autumnHandler({
					customerId: organization.id,
					customerData: { name: organization.name },
					clientOptions: { secretKey: Resource.AutumnSecretKey.value },
					request: {
						url: source.url,
						method: source.method,
						body: ["PATCH", "POST", "PUT"].includes(source.method)
							? await source
									.clone()
									.json()
									.catch(() => null)
							: null,
					},
				}),
			catch: () => InternalServerError.new(),
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
			),
			Effect.catchCause(() =>
				Effect.succeed({
					response: { message: "Billing request failed." },
					statusCode: 500,
				}),
			),
		);

		yield* Observability.recordAction(
			"billing.passthrough",
			result.statusCode >= 500 ? "failure" : "success",
		);

		return HttpServerResponse.fromWeb(
			Response.json(result.response, { status: result.statusCode }),
		);
	});

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "billing", (handlers) =>
			handlers
				.handleRaw("billingGet", ({ request }) =>
					handlePassthrough(request).pipe(
						Effect.catchIf(HttpServerResponse.isHttpServerResponse, Effect.succeed),
					),
				)
				.handleRaw("billingPost", ({ request }) =>
					handlePassthrough(request).pipe(
						Effect.catchIf(HttpServerResponse.isHttpServerResponse, Effect.succeed),
					),
				),
		);
}
