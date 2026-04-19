import { Context, Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { fromCloudflareEnv } from "sst/resource/cloudflare";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import { BackgroundTasks } from "@leuchtturm/api/background";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { ApiAnalytics } from "@leuchtturm/api/posthog";
import { Auth } from "@leuchtturm/core/auth";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { DatabaseError } from "@leuchtturm/core/errors";

namespace Api {
	export interface Env {
		readonly HYPERDRIVE: {
			readonly connectionString: string;
		};
	}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, Error>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Api") {}

	export const layer = (env: Env, waitUntil?: (promise: Promise<unknown>) => void) => {
		const handlers = Layer.mergeAll(HealthHandler.layer, ZeroHandler.layer, AuthHandler.layer);
		const api = HttpRouter.toHttpEffect(
			HttpApiBuilder.layer(LeuchtturmApi).pipe(
				Layer.provide(handlers),
				Layer.provide(AuthMiddleware.layer),
			),
		).pipe(Effect.flatten);
		const database = Database.layer(env.HYPERDRIVE.connectionString);
		const core = Layer.mergeAll(Auth.defaultLayer, FeatureFlags.defaultLayer).pipe(
			Layer.provideMerge(database),
		);
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
					handle: Effect.fn("Api.handle")((request: Request) => {
						const startedAt = Date.now();

						return Effect.tryPromise({
							try: () => handler.handler(request, Context.empty()),
							catch: (error) =>
								new DatabaseError({
									message: `API handler failed: ${String(error)}`,
								}),
						}).pipe(
							Effect.tap((response) =>
								analytics.captureRequest(request, response, Date.now() - startedAt),
							),
							Effect.tap((response) =>
								response.status >= 500
									? analytics.captureException(
											new DatabaseError({
												message: `API request failed with status ${response.status}`,
											}),
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

	export const create = (env: Env, waitUntil?: (promise: Promise<unknown>) => void) =>
		makeRuntime(Service, layer(env, waitUntil));
}

export default {
	fetch(request: Request, env: Api.Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }) {
		fromCloudflareEnv(env);
		return Api.create(env, ctx.waitUntil.bind(ctx)).runPromise((api) => api.handle(request));
	},
};
