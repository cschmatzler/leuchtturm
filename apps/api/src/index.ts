import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
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
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Telemetry } from "@leuchtturm/api/observability/telemetry";
import { Auth } from "@leuchtturm/core/auth";
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
			})(RequestContext.middleware(app)),
	},
);

const handleRequest = Effect.fn("handleRequest")(function* (
	request: Request,
	executionContext: Pick<ExecutionContext, "waitUntil">,
) {
	const startedAt = yield* Clock.currentTimeMillis;
	const baseContext = RequestContext.make(request, executionContext);
	const url = new URL(request.url);

	return yield* Telemetry.withRequestContext(baseContext)(
		Effect.scoped(
			Effect.gen(function* () {
				const telemetryContext = yield* Effect.context<never>();
				const servicesContext = yield* Layer.build(
					Layer.mergeAll(Auth.defaultLayer, ZeroDatabase.layer).pipe(
						Layer.provideMerge(Database.layer(Resource.Database.connectionString)),
					),
				);
				const requestContext = Context.merge(
					telemetryContext,
					Context.merge(baseContext, servicesContext),
				);

				return yield* Effect.provideContext(
					Effect.tryPromise({
						try: () => handler(request, requestContext),
						catch: (cause) => cause,
					}).pipe(
						Effect.tap((response) =>
							Effect.gen(function* () {
								const durationMs = (yield* Clock.currentTimeMillis) - startedAt;
								const attributes = {
									method: request.method,
									path: url.pathname,
									status: String(response.status),
								};

								yield* Effect.annotateCurrentSpan({
									"http.response.status_code": response.status,
								});
								yield* Effect.all([
									Metric.update(
										Metric.counter("api_requests_total", {
											attributes,
											description: "Total number of API requests handled by the worker.",
											incremental: true,
										}),
										1,
									),
									Metric.update(
										Metric.histogram("api_request_duration_ms", {
											attributes,
											boundaries: Metrics.requestDurationBoundaries,
											description: "End-to-end duration of API request handling in milliseconds.",
										}),
										durationMs,
									),
								]);
							}),
						),
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
		).pipe(
			Effect.withSpan(`${request.method} ${url.pathname}`, {
				attributes: {
					"http.request.method": request.method,
					"url.path": url.pathname,
				},
				kind: "server",
				root: true,
			}),
		),
	);
});

export default wrapCloudflareHandler({
	fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
		return Effect.runPromise(handleRequest(request, ctx));
	},
});
