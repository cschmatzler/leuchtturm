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
import { Resource, wrapCloudflareHandler } from "sst/resource/cloudflare";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { ErrorCatalog } from "@leuchtturm/api/error-catalog";
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
import { Auth } from "@leuchtturm/core/auth";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/database";
import { InternalServerError } from "@leuchtturm/core/errors";
import { ZeroDatabase } from "@leuchtturm/zero/zero-database";

const apiRoutes = HttpApiBuilder.layer(LeuchtturmApi).pipe(
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
);

const apiServices = Layer.mergeAll(HttpServer.layerServices, Metrics.layer, Telemetry.layer);

const api = HttpRouter.toHttpEffect(apiRoutes).pipe(Effect.flatten);

const { handler } = HttpEffect.toWebHandlerLayer(api, apiServices, {
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

const handleRequest = Effect.fn("handleRequest")(function* (
	request: Request,
	executionContext: Pick<ExecutionContext, "waitUntil">,
) {
	const activeContext = yield* Telemetry.withActiveSpan(
		RequestContext.make(request, executionContext),
	);

	return yield* Effect.scoped(
		Effect.gen(function* () {
			const servicesContext = yield* Layer.build(
				Layer.mergeAll(Auth.defaultLayer, Billing.defaultLayer, ZeroDatabase.layer).pipe(
					Layer.provideMerge(Database.layer(Resource.Database.connectionString)),
				),
			);
			const requestContext = Context.merge(activeContext, servicesContext);

			return yield* Effect.provideContext(
				Effect.promise(() => handler(request, requestContext)).pipe(
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
				requestContext,
			);
		}),
	);
});

export default wrapCloudflareHandler(
	instrument(
		{
			fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
				return Effect.runPromise(handleRequest(request, ctx));
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
