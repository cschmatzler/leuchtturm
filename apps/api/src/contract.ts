import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import { AuthError } from "@leuchtturm/core/auth/errors";
import {
	DatabaseError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@leuchtturm/core/errors";
import { MailEncryptionError } from "@leuchtturm/core/mail/errors";
import { GmailOAuthError } from "@leuchtturm/core/mail/gmail/errors";
import { MailAccountId, MailOAuthStateId } from "@leuchtturm/core/mail/schema";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });
const HealthCheckSuccessResponse = Schema.Struct({
	success: Schema.Literal(true),
	database: Schema.Struct({
		status: Schema.Literal("up"),
		latencyMs: Schema.Number,
	}),
	totalTimeMs: Schema.Number,
});
const AuthRouteError = Schema.Union([UnauthorizedError, AuthError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthError]);
const MailOAuthUrlError = Schema.Union([ProtectedRouteError, GmailOAuthError]);
const MailOAuthCallbackError = Schema.Union([
	ProtectedRouteError,
	GmailOAuthError,
	MailEncryptionError,
	ValidationError,
]);
const MailDisconnectError = Schema.Union([ProtectedRouteError, NotFoundError]);
const GmailPushError = Schema.Union([DatabaseError, UnauthorizedError]);

export const health = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: HealthCheckSuccessResponse,
		error: DatabaseError,
	}),
);

export const zero = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: ProtectedRouteError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: ProtectedRouteError }))
	.middleware(AuthMiddleware.Service);

export const auth = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

export const mail = HttpApiGroup.make("mail")
	.add(
		HttpApiEndpoint.get("mailOAuthUrl", "/mail/oauth/url", {
			success: Schema.Struct({ url: Schema.String }),
			error: MailOAuthUrlError,
		}),
	)
	.add(
		HttpApiEndpoint.post("mailOAuthCallback", "/mail/oauth/callback", {
			payload: Schema.Struct({ code: Schema.String, state: MailOAuthStateId }),
			success: Schema.Struct({ accountId: MailAccountId }),
			error: MailOAuthCallbackError,
		}),
	)
	.add(
		HttpApiEndpoint.post("mailDisconnect", "/mail/disconnect", {
			payload: Schema.Struct({ accountId: MailAccountId }),
			success: SuccessResponse,
			error: MailDisconnectError,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const webhook = HttpApiGroup.make("webhook").add(
	HttpApiEndpoint.post("gmailPush", "/webhook/gmail", {
		headers: Schema.Struct({
			authorization: Schema.optional(Schema.String),
			"x-goog-subscription": Schema.optional(Schema.String),
			"x-goog-topic": Schema.optional(Schema.String),
		}),
		payload: Schema.Struct({
			message: Schema.optional(
				Schema.Struct({
					data: Schema.optional(Schema.String),
				}),
			),
			subscription: Schema.optional(Schema.String),
		}),
		success: SuccessResponse,
		error: GmailPushError,
	}),
);

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(health, zero, auth, mail, webhook)
	.prefix("/api") {}
