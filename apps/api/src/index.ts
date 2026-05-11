import { instrument } from "@microlabs/otel-cf-workers";
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
import { ErrorCatalog } from "@leuchtturm/api/error-catalog";
import { FeatureFlags } from "@leuchtturm/api/feature-flags";
import { AuthHandler } from "@leuchtturm/api/handlers/auth-handler";
import { BillingHandler } from "@leuchtturm/api/handlers/billing-handler";
import { HealthHandler } from "@leuchtturm/api/handlers/health-handler";
import { SessionHandler } from "@leuchtturm/api/handlers/session-handler";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero-handler";
import { AuthMiddleware } from "@leuchtturm/api/middleware/auth-middleware";
import { Observability } from "@leuchtturm/api/middleware/observability";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Telemetry } from "@leuchtturm/api/observability/telemetry";
import { ProductAnalytics } from "@leuchtturm/api/product-analytics";
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/database";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { InternalServerError } from "@leuchtturm/core/errors";

namespace Api {
	export interface Interface {
		readonly handle: (
			request: Request,
			executionContext: Pick<ExecutionContext, "waitUntil">,
		) => Effect.Effect<Response, InternalServerError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/api/Api") {}

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
			Telemetry.layer,
		);

		const handler: {
			readonly dispose: () => Promise<void>;
			readonly handler: (
				request: Request,
				context: ReturnType<typeof RequestContext.make>,
			) => Promise<Response>;
		} = HttpEffect.toWebHandlerLayer(api, runtime, {
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
					(request: Request, executionContext: Pick<ExecutionContext, "waitUntil">) =>
						Telemetry.withActiveSpan(RequestContext.make(request, executionContext)).pipe(
							Effect.flatMap((requestContext) =>
								Effect.promise(() => handler.handler(request, requestContext)),
							),
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
						),
				),
			}),
		);
	}
}

const apiRuntime = makeRuntime(Api.Service, Api.layer());

export default wrapCloudflareHandler(
	instrument(
		{
			fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
				return apiRuntime.runPromise((api) => api.handle(request, ctx));
			},
		},
		() => ({
			exporter: {
				headers: {
					Authorization: JSON.parse(Resource.GrafanaOtlpConfig.value).authorization,
				},
				url: `${JSON.parse(Resource.GrafanaOtlpConfig.value).url}/v1/traces`,
			},
			service: {
				name: "leuchtturm-api",
				namespace: "leuchtturm",
			},
		}),
	),
);
