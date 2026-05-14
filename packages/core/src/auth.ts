import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { AsyncLocalStorage } from "node:async_hooks";

import { BetterAuth } from "@leuchtturm/core/auth/better-auth";
import {
	AuthError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidSessionPayloadError,
	AuthOrganizationLookupError,
	AuthSessionLookupError,
} from "@leuchtturm/core/auth/errors";
import { OrganizationSelect, SessionData } from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Email } from "@leuchtturm/email";

export namespace Auth {
	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, unknown>;
		readonly getSession: (
			headers: Headers,
		) => Effect.Effect<typeof SessionData.Type | null, typeof AuthError.Type>;
		readonly getOrganization: (
			headers: Headers,
			organizationId: string,
		) => Effect.Effect<
			Pick<typeof OrganizationSelect.Type, "id" | "name" | "slug"> | null,
			typeof AuthError.Type
		>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const context = new AsyncLocalStorage<Context.Context<never>>();
			const auth = yield* BetterAuth.create(context);

			const handle = Effect.fn("Auth.handle")(function* (request: Request) {
				return yield* Effect.gen(function* () {
					const currentContext = yield* Effect.context();

					return yield* Effect.tryPromise({
						try: () => context.run(currentContext, () => auth.handler(request)),
						catch: (cause) => cause,
					}).pipe(
						Effect.tap((response) =>
							Effect.annotateCurrentSpan({ "http.response.status_code": response.status }),
						),
					);
				}).pipe(
					Effect.withSpan("better-auth.handler", {
						attributes: {
							"http.request.method": request.method,
							"url.path": new URL(request.url).pathname,
						},
					}),
				);
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				return yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (cause) => cause,
				}).pipe(
					Effect.tapCause((cause) =>
						Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
					),
					Effect.mapError(() => new AuthSessionLookupError()),
					Effect.flatMap((session) => {
						if (!session) return Effect.succeed(null);

						return Schema.decodeUnknownEffect(SessionData)(session).pipe(
							Effect.tapCause((cause) =>
								Effect.annotateCurrentSpan({
									"error.original_cause": Cause.pretty(cause),
								}),
							),
							Effect.mapError(() => new AuthInvalidSessionPayloadError()),
						);
					}),
				);
			});

			const getOrganization = Effect.fn("Auth.getOrganization")(function* (
				headers: Headers,
				organizationId: string,
			) {
				return yield* Effect.tryPromise({
					try: () =>
						auth.api.getFullOrganization({
							headers,
							query: { organizationId },
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.tapCause((cause) =>
						Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
					),
					Effect.mapError(() => new AuthOrganizationLookupError()),
					Effect.flatMap((organization) => {
						if (!organization) return Effect.succeed(null);

						return Schema.decodeUnknownEffect(OrganizationSelect)(organization).pipe(
							Effect.tapCause((cause) =>
								Effect.annotateCurrentSpan({
									"error.original_cause": Cause.pretty(cause),
								}),
							),
							Effect.mapError(() => new AuthInvalidOrganizationPayloadError()),
						);
					}),
				);
			});

			return Service.of({ handle, getSession, getOrganization });
		}),
	);

	export const defaultLayer = Layer.provide(
		layer,
		Layer.mergeAll(Billing.defaultLayer, Email.defaultLayer),
	);
}
