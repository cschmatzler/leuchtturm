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

import { Contract } from "@leuchtturm/api/contract";
import { AuthHandler } from "@leuchtturm/api/handlers/auth/index";
import { BillingHandler } from "@leuchtturm/api/handlers/billing/index";
import { DocsHandler } from "@leuchtturm/api/handlers/docs/index";
import { HealthHandler } from "@leuchtturm/api/handlers/health/index";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero/index";
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

const apiRoutes = Layer.mergeAll(
	HttpApiBuilder.layer(Contract.Api, {
		openapiPath: "/open-api",
	}).pipe(
		Layer.provide(
			Layer.mergeAll(
				HealthHandler.layer(Contract.Api),
				BillingHandler.layer(Contract.Api),
				ZeroHandler.layer(Contract.Api),
				AuthHandler.layer(Contract.Api),
			),
		),
		Layer.provide(AuthMiddleware.layer),
	),
	DocsHandler.layer,
);

const { handler } = HttpEffect.toWebHandlerLayer(
	HttpRouter.toHttpEffect(apiRoutes).pipe(Effect.flatten),
	Layer.mergeAll(HttpServer.layerServices, Metrics.layer, Telemetry.layer),
	{
		middleware: (app) =>
			HttpMiddleware.cors({
				allowedOrigins: (origin) => {
					if (!origin) return false;
					if (Resource.App.stage !== "prod") return true;

					return origin === `https://${Resource.Dns.AppDomain}`;
				},
				credentials: true,
			})(RequestContext.middleware(Observability.middleware(app))),
	},
);

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
					Effect.tapCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({
								"error.original_cause": Cause.pretty(cause),
							});
							yield* Effect.logError("API handler failed").pipe(
								Effect.annotateLogs({ cause: Cause.pretty(cause), url: request.url }),
							);
						}),
					),
					Effect.mapError(() => new InternalServerError()),
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
