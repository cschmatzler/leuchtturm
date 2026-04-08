import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth/http-auth";
import {
	AuthServiceError,
	DatabaseError,
	UnauthorizedError,
	ValidationError,
} from "@leuchtturm/core/errors";
import { MailAccountId, MailOAuthStateId } from "@leuchtturm/core/mail/schema";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });
const AuthRouteError = Schema.Union([UnauthorizedError, AuthServiceError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthServiceError]);

export const health = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
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
			error: ProtectedRouteError,
		}),
	)
	.add(
		HttpApiEndpoint.post("mailOAuthCallback", "/mail/oauth/callback", {
			payload: Schema.Struct({ code: Schema.String, state: MailOAuthStateId }),
			success: Schema.Struct({ accountId: MailAccountId }),
			error: Schema.Union([ProtectedRouteError, ValidationError]),
		}),
	)
	.add(
		HttpApiEndpoint.post("mailDisconnect", "/mail/disconnect", {
			payload: Schema.Struct({ accountId: MailAccountId }),
			success: SuccessResponse,
			error: ProtectedRouteError,
		}),
	)
	.middleware(AuthMiddleware.Service);

export const webhook = HttpApiGroup.make("webhook").add(
	HttpApiEndpoint.post("gmailPush", "/webhook/gmail", {
		payload: Schema.Struct({
			message: Schema.optional(
				Schema.Struct({
					data: Schema.optional(Schema.String),
				}),
			),
		}),
		success: SuccessResponse,
		error: DatabaseError,
	}),
);

export class LeuchtturmApi extends HttpApi.make("leuchtturm")
	.add(health, zero, auth, mail, webhook)
	.prefix("/api") {}
