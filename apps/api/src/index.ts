import { Effect, Layer, ServiceMap } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthMiddlewareServer } from "@leuchtturm/api/auth/http-auth-server";
import { BackgroundTasks } from "@leuchtturm/api/background";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { MailHandler, WebhookHandler } from "@leuchtturm/api/handlers/mail";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { ApiAnalytics } from "@leuchtturm/api/posthog";
import { Auth } from "@leuchtturm/core/auth";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { Email } from "@leuchtturm/core/email";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";

namespace ApiRuntime {
	export interface Env {
		readonly HYPERDRIVE: {
			readonly connectionString: string;
		};
	}

	const handlers = Layer.mergeAll(
		HealthHandler.layer,
		ZeroHandler.layer,
		AuthHandler.layer,
		MailHandler.layer,
		WebhookHandler.layer,
	);

	const api = HttpRouter.toHttpEffect(
		HttpApiBuilder.layer(LeuchtturmApi).pipe(
			Layer.provide(handlers),
			Layer.provide(AuthMiddlewareServer.layer),
		),
	).pipe(Effect.flatten);

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, globalThis.Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/ApiRuntime") {}

	export const layer = (
		connectionString: string,
		waitUntil?: (promise: Promise<unknown>) => void,
	) => {
		const database = Database.layer(connectionString);
		const core = Layer.mergeAll(
			Auth.defaultLayer,
			Email.defaultLayer,
			FeatureFlags.defaultLayer,
			Gmail.defaultLayer,
		).pipe(Layer.provideMerge(database));
		const runtime = Layer.mergeAll(
			core,
			HttpServer.layerServices,
			BackgroundTasks.layer(waitUntil),
		);
		const handler = HttpEffect.toWebHandlerLayer(api, runtime, {
			middleware: RequestContext.Middleware,
		});

		return Layer.effect(
			Service,
			Effect.gen(function* () {
				const analytics = yield* ApiAnalytics.Service;

				return Service.of({
					handle: Effect.fn("ApiRuntime.handle")((request: Request) => {
						const startedAt = Date.now();

						return Effect.tryPromise({
							try: () => handler.handler(request, ServiceMap.empty()),
							catch: (error) =>
								error instanceof globalThis.Error
									? error
									: new globalThis.Error(`API handler failed: ${String(error)}`),
						}).pipe(
							Effect.tap((response) =>
								analytics.captureRequest(request, response, Date.now() - startedAt),
							),
							Effect.tap((response) =>
								response.status >= 500
									? analytics.captureException(
											new globalThis.Error(`API request failed with status ${response.status}`),
											request,
											{
												duration_ms: Date.now() - startedAt,
												status: response.status,
												type: "response",
											},
										)
									: Effect.succeed(undefined),
							),
							Effect.tapError((error) =>
								analytics.captureException(error, request, {
									duration_ms: Date.now() - startedAt,
									type: "exception",
								}),
							),
						);
					}),
				});
			}),
		).pipe(Layer.provide(ApiAnalytics.layer(waitUntil)));
	};

	export const create = (
		connectionString: string,
		waitUntil?: (promise: Promise<unknown>) => void,
	) => makeRuntime(Service, layer(connectionString, waitUntil));
}

export default {
	fetch(
		request: Request,
		env: ApiRuntime.Env,
		ctx: { waitUntil: (promise: Promise<unknown>) => void },
	) {
		return ApiRuntime.create(env.HYPERDRIVE.connectionString, ctx.waitUntil.bind(ctx)).runPromise(
			(api) => api.handle(request),
		);
	},
};
