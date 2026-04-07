import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	Context as LambdaContext,
} from "aws-lambda";
import { Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServer } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { WorkflowEngine } from "effect/unstable/workflow";
import { handleLambdaEvent } from "srvx/aws-lambda";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { MailHandlerLive, WebhookHandlerLive } from "@chevrotain/api/handlers/mail";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth-live";
import { RequestContextMiddleware } from "@chevrotain/api/middleware/request-context";
import { Auth } from "@chevrotain/core/auth";
import { Database } from "@chevrotain/core/drizzle";
import { Email } from "@chevrotain/core/email";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { Gmail } from "@chevrotain/core/mail/gmail/workflows";

const ApiHandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	MailHandlerLive,
	WebhookHandlerLive,
);

const BaseLive = Layer.mergeAll(
	Database.defaultLayer,
	Email.defaultLayer,
	MailEncryption.defaultLayer,
	GmailOAuth.defaultLayer,
	Auth.defaultLayer,
	WorkflowEngine.layerMemory,
);

const ApiRuntimeLive = Layer.mergeAll(Gmail.BootstrapWorkflowLive, Gmail.DeltaWorkflowLive).pipe(
	Layer.provideMerge(BaseLive),
);

const httpApp = HttpRouter.toHttpEffect(
	HttpApiBuilder.layer(ChevrotainApi).pipe(
		Layer.provide(ApiHandlersLive),
		Layer.provide(AuthMiddlewareLive),
	),
).pipe(Effect.flatten);

const lambdaWebHandler = HttpEffect.toWebHandlerLayer(
	httpApp,
	Layer.mergeAll(ApiRuntimeLive, HttpServer.layerServices),
	{ middleware: RequestContextMiddleware },
);

export const handler = (event: APIGatewayProxyEventV2, context: LambdaContext) =>
	handleLambdaEvent(lambdaWebHandler.handler, event, context).then(
		(result) => result as APIGatewayProxyResultV2,
	);
