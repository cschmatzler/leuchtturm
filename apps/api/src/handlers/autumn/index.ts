import { autumnHandler } from "autumn-js/backend";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { Resource } from "sst/resource/cloudflare";

import type { Contract } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Auth } from "@leuchtturm/core/auth";

export namespace AutumnHandler {
	const jsonResponse = (body: unknown, status: number) =>
		HttpServerResponse.fromWeb(Response.json(body, { status }));

	const parseJsonBody = Effect.fn("autumn.parseJsonBody")(function* (request: Request) {
		if (!["PATCH", "POST", "PUT"].includes(request.method)) return null;

		return yield* Effect.promise(async () => {
			try {
				return await request.json();
			} catch {
				return null;
			}
		});
	});

	const handleAutumn = Effect.fn("autumn.handle")(function* () {
		const auth = yield* Auth.Service;
		const request = yield* HttpServerRequest.HttpServerRequest;
		const source = request.source as Request;
		const headers = new Headers(request.headers as Record<string, string>);

		const session = yield* auth.getSession(headers);
		if (!session) {
			return jsonResponse({ message: "Unauthorized." }, 401);
		}

		if (!session.session.activeOrganizationId) {
			return jsonResponse({ message: "Forbidden." }, 403);
		}

		const organization = yield* auth.getOrganization(headers, session.session.activeOrganizationId);
		if (!organization) {
			return jsonResponse({ message: "Forbidden." }, 403);
		}

		const body = yield* parseJsonBody(source);
		const result = yield* Effect.tryPromise({
			try: async (): Promise<{ response: unknown; statusCode: number }> => {
				const result = await autumnHandler({
					customerId: organization.id,
					customerData: {
						name: organization.name,
					},
					clientOptions: {
						secretKey: Resource.AutumnSecretKey.value,
					},
					request: {
						url: source.url,
						method: source.method,
						body,
					},
				});

				return {
					response: result.response,
					statusCode: result.statusCode,
				};
			},
			catch: (cause) => cause,
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
			),
			Effect.catchCause(() =>
				Effect.succeed({
					response: { message: "Autumn request failed." },
					statusCode: 500,
				}),
			),
		);

		yield* Metrics.action("autumn.request", result.statusCode >= 500 ? "failure" : "success");

		return jsonResponse(result.response, result.statusCode);
	});

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "autumn", (handlers) =>
			handlers
				.handleRaw("autumnGet", () => handleAutumn())
				.handleRaw("autumnPost", () => handleAutumn()),
		);
}
