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
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Observability } from "@leuchtturm/api/observability";
import { Auth } from "@leuchtturm/core/auth";
import { Database } from "@leuchtturm/core/database";
import { InternalServerError } from "@leuchtturm/core/errors";
import { ZeroDatabase } from "@leuchtturm/zero/zero-database";

namespace Api {
	const routes = Layer.mergeAll(
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
		HttpRouter.toHttpEffect(routes).pipe(Effect.flatten),
		HttpServer.layerServices,
		{
			middleware: (app) =>
				app.pipe(
					HttpMiddleware.logger,
					Observability.middleware,
					RequestContext.middleware,
					HttpMiddleware.cors({
						allowedOrigins: (origin) => {
							if (!origin) return false;
							if (Resource.App.stage !== "prod") return true;

							return origin === `https://${Resource.Dns.AppDomain}`;
						},
						credentials: true,
					}),
				),
		},
	);

	export const handleRequest = Effect.fn("handleRequest")(function* (
		request: Request,
		executionContext: Pick<ExecutionContext, "waitUntil">,
	) {
		const requestContext = RequestContext.make(request, executionContext);

		return yield* Observability.withRequestContext(requestContext)((requestContext) =>
			Effect.gen(function* () {
				const services = yield* Layer.mergeAll(Auth.defaultLayer, ZeroDatabase.layer).pipe(
					Layer.provideMerge(Database.layer(Resource.Database.connectionString)),
					Layer.build,
				);
				const context = Context.merge(requestContext, services);

				return yield* Effect.tryPromise({
					try: () => handler(request, context),
					catch: (cause) => cause,
				}).pipe(
					Effect.tap((response) =>
						Effect.annotateCurrentSpan({ "http.response.status_code": response.status }),
					),
					Effect.mapError(() => new InternalServerError()),
					Effect.provideContext(context),
				);
			}).pipe(
				Effect.scoped,
				Effect.withSpan(`${request.method} ${request.url}`, {
					attributes: {
						"http.request.method": request.method,
						"url.full": request.url,
					},
					kind: "server",
					root: true,
				}),
			),
		);
	});
}

export default wrapCloudflareHandler({
	fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
		return Effect.runPromise(Api.handleRequest(request, ctx));
	},
});
