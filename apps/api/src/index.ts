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
import { ExecutionContext } from "@leuchtturm/api/execution-context";
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
					RequestContext.middleware,
					HttpMiddleware.cors({
						allowedOrigins: (origin) => {
							if (!origin) return false;
							if (Resource.App.stage !== "prod") return true;

							return origin === `https://${Resource.Dns.AppDomain}`;
						},
						credentials: true,
					}),
					Observability.middleware,
				),
		},
	);

	export const handleRequest = Effect.fn("handleRequest")(function* (
		request: Request,
		executionContext: ExecutionContext.Interface,
	) {
		const context = Context.merge(
			RequestContext.make(request),
			ExecutionContext.make(executionContext),
		);

		return yield* Effect.gen(function* () {
			const services = yield* Layer.mergeAll(
				Observability.layer,
				Auth.defaultLayer,
				ZeroDatabase.layer,
			).pipe(Layer.provideMerge(Database.layer(Resource.Database.connectionString)), Layer.build);
			const observability = Context.get(services, Observability.Service);
			const handlerContext = Context.merge(context, services);

			return yield* Effect.tryPromise({
				try: () => handler(request, handlerContext),
				catch: (cause) => cause,
			}).pipe(
				Effect.mapError(() => new InternalServerError()),
				Effect.ensuring(
					Effect.sync(() => {
						executionContext.waitUntil(Effect.runPromise(observability.flush));
					}),
				),
				Effect.provideContext(handlerContext),
			);
		}).pipe(Effect.scoped, Effect.provideContext(context));
	});
}

export default wrapCloudflareHandler({
	fetch(request: Request, _env: unknown, ctx: globalThis.ExecutionContext) {
		return Effect.runPromise(Api.handleRequest(request, ctx));
	},
});
