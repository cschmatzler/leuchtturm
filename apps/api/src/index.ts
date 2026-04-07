import { Effect, Layer, ServiceMap } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { WorkflowEngine } from "effect/unstable/workflow";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { AuthHandler as authHandler } from "@chevrotain/api/handlers/auth";
import { HealthHandler as healthHandler } from "@chevrotain/api/handlers/health";
import {
	MailHandler as mailHandler,
	WebhookHandler as webhookHandler,
} from "@chevrotain/api/handlers/mail";
import { ZeroHandler as zeroHandler } from "@chevrotain/api/handlers/zero";
import { authMiddlewareLayer } from "@chevrotain/api/middleware/auth-middleware";
import { RequestContextMiddleware } from "@chevrotain/api/middleware/request-context";
import { Auth } from "@chevrotain/core/auth";
import { Database } from "@chevrotain/core/drizzle";
import { makeRuntime } from "@chevrotain/core/effect/run-service";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { Gmail } from "@chevrotain/core/mail/gmail/workflows";

type WorkerEnv = {
	HYPERDRIVE: {
		connectionString: string;
	};
};

const apiHandlers = Layer.mergeAll(
	healthHandler,
	zeroHandler,
	authHandler,
	mailHandler,
	webhookHandler,
);

const api = HttpRouter.toHttpEffect(
	HttpApiBuilder.layer(ChevrotainApi).pipe(
		Layer.provide(apiHandlers),
		Layer.provide(authMiddlewareLayer),
	),
).pipe(Effect.flatten);

namespace ApiRuntime {
	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, globalThis.Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/ApiRuntime") {}

	export const layer = (connectionString: string) => {
		const database = Database.layer(connectionString);
		const auth = Auth.defaultLayer.pipe(Layer.provide(database));
		const gmail = Gmail.layer.pipe(
			Layer.provide(
				Layer.mergeAll(
					database,
					MailEncryption.defaultLayer,
					GmailOAuth.defaultLayer,
					WorkflowEngine.layerMemory,
				),
			),
		);
		const runtime = Layer.mergeAll(
			database,
			auth,
			MailEncryption.defaultLayer,
			GmailOAuth.defaultLayer,
			WorkflowEngine.layerMemory,
			HttpServer.layerServices,
			gmail,
		);
		const handler = HttpEffect.toWebHandlerLayer(api, runtime, {
			middleware: RequestContextMiddleware,
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

const apiRuntimes = new Map<string, ReturnType<typeof ApiRuntime.create>>();

function getApiRuntime(connectionString: string) {
	let runtime = apiRuntimes.get(connectionString);
	if (!runtime) {
		runtime = ApiRuntime.create(connectionString);
		apiRuntimes.set(connectionString, runtime);
	}
	return runtime;
}

export default {
	fetch(request: Request, env: WorkerEnv) {
		return getApiRuntime(env.HYPERDRIVE.connectionString).runPromise((api) => api.handle(request));
	},
};
