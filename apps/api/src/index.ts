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

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { ErrorCatalog } from "@leuchtturm/api/errors";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { BillingHandler } from "@leuchtturm/api/handlers/billing";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { SessionHandler } from "@leuchtturm/api/handlers/session";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { AuthMiddleware } from "@leuchtturm/api/middleware/auth";
import { Observability } from "@leuchtturm/api/middleware/observability";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { ProductAnalytics } from "@leuchtturm/api/posthog";
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { InternalServerError } from "@leuchtturm/core/errors";

namespace Api {
	export interface Interface {
		readonly handle: (
			request: Request,
			executionContext: Pick<ExecutionContext, "waitUntil">,
		) => Effect.Effect<Response, InternalServerError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Api") {}

	export function layer() {
		const api = HttpRouter.toHttpEffect(
			HttpApiBuilder.layer(LeuchtturmApi).pipe(
				Layer.provide(
					Layer.mergeAll(
						HealthHandler.layer,
						SessionHandler.layer,
						BillingHandler.layer,
						ZeroHandler.layer,
						AuthHandler.layer,
					),
				),
				Layer.provide(AuthMiddleware.layer),
				Layer.provide(ErrorCatalog.layer),
			),
		).pipe(Effect.flatten);

		const database = Database.layer(Resource.Database.connectionString);

		const core = Layer.mergeAll(
			Auth.defaultLayer,
			Billing.defaultLayer,
			FeatureFlags.defaultLayer,
		).pipe(Layer.provideMerge(database));

		const runtime = Layer.mergeAll(
			core,
			HttpServer.layerServices,
			ProductAnalytics.layer,
			Metrics.layer,
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
				})(RequestContext.middleware(Observability.middleware(app))),
		});

		return Layer.succeed(
			Service,
			Service.of({
				handle: Effect.fn("Api.handle")(
					(request: Request, executionContext: Pick<ExecutionContext, "waitUntil">) => {
						const requestContext = RequestContext.make(request, executionContext);

						return Effect.promise(() =>
							(
								handler.handler as (
									request: Request,
									context: ReturnType<typeof RequestContext.make>,
								) => Promise<Response>
							)(request, requestContext),
						).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									yield* Effect.logError("API handler failed").pipe(
										Effect.annotateLogs({ cause: Cause.pretty(cause), url: request.url }),
									);

									return yield* Effect.fail(new InternalServerError());
								}),
							),
						);
					},
				),
			}),
		);
	}

	export function create() {
		return makeRuntime(Service, layer());
	}
}

export default wrapCloudflareHandler({
	fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
		return Api.create().runPromise((api) => api.handle(request, ctx));
	},
});
