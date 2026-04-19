import { instrument } from "@microlabs/otel-cf-workers";
import { trace } from "@opentelemetry/api";
import { Context, Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { fromCloudflareEnv } from "sst/resource/cloudflare";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { BackgroundTasks } from "@leuchtturm/api/background";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Observability } from "@leuchtturm/api/observability";
import { ProductAnalytics } from "@leuchtturm/api/posthog";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";
import { Auth } from "@leuchtturm/core/auth";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { DatabaseError } from "@leuchtturm/core/errors";

namespace Api {
	export interface Env {
		readonly Database: {
			readonly connectionString: string;
		};
	}

	export interface Interface {
		readonly handle: (
			request: Request,
			waitUntil?: (promise: Promise<unknown>) => void,
		) => Effect.Effect<Response, Error>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Api") {}

	let cachedConnectionString: string | undefined;
	let cachedRuntime: ReturnType<typeof makeRuntime<Service, Interface, never>> | undefined;

	export const layer = (env: Env) => {
		const handlers = Layer.mergeAll(HealthHandler.layer, ZeroHandler.layer, AuthHandler.layer);
		const api = HttpRouter.toHttpEffect(
			HttpApiBuilder.layer(LeuchtturmApi).pipe(
				Layer.provide(handlers),
				Layer.provide(AuthMiddleware.layer),
			),
		).pipe(Effect.flatten);
		const database = Database.layer(env.Database.connectionString);
		const core = Layer.mergeAll(Auth.defaultLayer, FeatureFlags.defaultLayer).pipe(
			Layer.provideMerge(database),
		);
		const runtime = Layer.mergeAll(
			core,
			HttpServer.layerServices,
			RequestRuntime.layer,
			BackgroundTasks.layer,
			ProductAnalytics.layer,
			Observability.layer,
		);
		const handler = HttpEffect.toWebHandlerLayer(api, runtime, {
			middleware: (app) => RequestContext.Middleware(Observability.Middleware(app)),
		});

		return Layer.succeed(
			Service,
			Service.of({
				handle: Effect.fn("Api.handle")(
					(request: Request, waitUntil?: (promise: Promise<unknown>) => void) => {
						const requestContext = RequestRuntime.makeContext({
							activeSpan: trace.getActiveSpan(),
							waitUntil,
						});

						return Effect.tryPromise({
							try: () => handler.handler(request, requestContext),
							catch: (error) =>
								new DatabaseError({
									message: `API handler failed: ${String(error)}`,
								}),
						});
					},
				),
			}),
		);
	};

	export const create = (env: Env) => {
		if (!cachedRuntime || cachedConnectionString !== env.Database.connectionString) {
			cachedConnectionString = env.Database.connectionString;
			cachedRuntime = makeRuntime(Service, layer(env));
		}

		return cachedRuntime;
	};
}

export default instrument(
	{
		fetch(request: Request, env: Api.Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }) {
			fromCloudflareEnv(env);
			return Api.create(env).runPromise((api) => api.handle(request, ctx.waitUntil.bind(ctx)));
		},
	},
	(env) => {
		fromCloudflareEnv(env);
		const { domain, token, tracesDataset } = Observability.traceExporterConfig();

		return {
			exporter: {
				headers: {
					Authorization: `Bearer ${token}`,
					"X-Axiom-Dataset": tracesDataset,
				},
				url: `https://${domain}/v1/traces`,
			},
			service: Observability.traceServiceConfig,
		};
	},
);
