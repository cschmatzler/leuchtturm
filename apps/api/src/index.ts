import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpEffect from "effect/unstable/http/HttpEffect";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { Resource } from "sst";
import { wrapCloudflareHandler } from "sst/resource/cloudflare";

import { AuthMiddlewareLayer } from "@leuchtturm/api/auth-layer";
import { BackgroundTasks } from "@leuchtturm/api/background";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { ErrorCatalog } from "@leuchtturm/api/errors";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { BillingHandler } from "@leuchtturm/api/handlers/billing";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { SessionHandler } from "@leuchtturm/api/handlers/session";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { Observability } from "@leuchtturm/api/middleware/observability";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { ProductAnalytics } from "@leuchtturm/api/posthog";
import { RequestRuntime } from "@leuchtturm/api/request-runtime";
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { InternalServerError } from "@leuchtturm/core/errors";

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
		) => Effect.Effect<Response, InternalServerError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Api") {}

	export const layer = (env: Env) => {
		const handlers = Layer.mergeAll(
			HealthHandler.layer,
			SessionHandler.layer,
			BillingHandler.layer,
			ZeroHandler.layer,
			AuthHandler.layer,
		);
		const api = HttpRouter.toHttpEffect(
			HttpApiBuilder.layer(LeuchtturmApi).pipe(
				Layer.provide(handlers),
				Layer.provide(AuthMiddlewareLayer.layer),
				Layer.provide(ErrorCatalog.layer),
			),
		).pipe(Effect.flatten);
		const database = Database.layer(env.Database.connectionString);
		const core = Layer.mergeAll(
			Auth.defaultLayer,
			Billing.defaultLayer,
			FeatureFlags.defaultLayer,
		).pipe(Layer.provideMerge(database));
		const runtime = Layer.mergeAll(
			core,
			HttpServer.layerServices,
			RequestRuntime.layer,
			BackgroundTasks.layer,
			ProductAnalytics.layer,
		);
		const handler = HttpEffect.toWebHandlerLayer(api, runtime, {
			middleware: (app) =>
				HttpMiddleware.cors({
					allowedOrigins: (origin) => {
						if (!origin) return false;
						if (Resource.App.stage !== "prod") return true;

						return origin === `https://${Resource.Dns.AppDomain}`;
					},
					credentials: true,
				})(RequestContext.Middleware(Observability.Middleware(app))),
		});

		return Layer.succeed(
			Service,
			Service.of({
				handle: Effect.fn("Api.handle")(
					(request: Request, waitUntil?: (promise: Promise<unknown>) => void) => {
						const requestContext = RequestRuntime.makeContext({
							waitUntil,
						});

						return Effect.tryPromise({
							try: () =>
								(
									handler.handler as (
										request: Request,
										context: ReturnType<typeof RequestRuntime.makeContext>,
									) => Promise<Response>
								)(request, requestContext),
							catch: (cause) => cause,
						}).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									const prettyCause = Cause.pretty(cause);
									yield* Effect.annotateCurrentSpan({ "error.original_cause": prettyCause });
									yield* Effect.logError("API handler failed").pipe(
										Effect.annotateLogs({ cause: prettyCause, url: request.url }),
									);

									return yield* Effect.fail(new InternalServerError());
								}),
							),
						);
					},
				),
			}),
		);
	};

	export const create = (env: Env) => makeRuntime(Service, layer(env));
}

export default wrapCloudflareHandler({
	fetch(request: Request, env: Api.Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }) {
		return Api.create(env).runPromise((api) => api.handle(request, ctx.waitUntil.bind(ctx)));
	},
});
