import { Effect, Layer, ServiceMap } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthMiddlewareServer } from "@leuchtturm/api/auth/http-auth-server";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { AuthHandler } from "@leuchtturm/api/handlers/auth";
import { HealthHandler } from "@leuchtturm/api/handlers/health";
import { MailHandler, WebhookHandler } from "@leuchtturm/api/handlers/mail";
import { ZeroHandler } from "@leuchtturm/api/handlers/zero";
import { RequestContext } from "@leuchtturm/api/middleware/request-context";
import { Auth } from "@leuchtturm/core/auth";
import { Database } from "@leuchtturm/core/drizzle";
import { makeRuntime } from "@leuchtturm/core/effect/run-service";
import { Gmail } from "@leuchtturm/core/mail/gmail/workflows";

namespace ApiRuntime {
	export interface Env {
		readonly HYPERDRIVE: {
			readonly connectionString: string;
		};
	}

	const handlers = Layer.mergeAll(
		HealthHandler.layer,
		ZeroHandler.layer,
		AuthHandler.layer,
		MailHandler.layer,
		WebhookHandler.layer,
	);

	const api = HttpRouter.toHttpEffect(
		HttpApiBuilder.layer(LeuchtturmApi).pipe(
			Layer.provide(handlers),
			Layer.provide(AuthMiddlewareServer.layer),
		),
	).pipe(Effect.flatten);

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, globalThis.Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/ApiRuntime") {}

	export const layer = (connectionString: string) => {
		const database = Database.layer(connectionString);
		const core = Layer.mergeAll(Auth.defaultLayer, Gmail.defaultLayer).pipe(
			Layer.provideMerge(database),
		);
		const runtime = Layer.mergeAll(core, HttpServer.layerServices);
		const handler = HttpEffect.toWebHandlerLayer(api, runtime, {
			middleware: RequestContext.Middleware,
		});

		return Layer.succeed(
			Service,
			Service.of({
				handle: Effect.fn("ApiRuntime.handle")((request: Request) =>
					Effect.tryPromise({
						try: () => handler.handler(request),
						catch: (error) =>
							error instanceof globalThis.Error
								? error
								: new globalThis.Error(`API handler failed: ${String(error)}`),
					}),
				),
			}),
		);
	};

	export const create = (connectionString: string) => makeRuntime(Service, layer(connectionString));
}

export default {
	fetch(request: Request, env: ApiRuntime.Env) {
		return ApiRuntime.create(env.HYPERDRIVE.connectionString).runPromise((api) =>
			api.handle(request),
		);
	},
};
