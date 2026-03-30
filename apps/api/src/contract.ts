import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import {
	AuthServiceError,
	DatabaseError,
	RateLimitError,
	UnauthorizedError,
	ValidationError,
} from "@chevrotain/core/errors";
import { MailAccountId, MailOAuthStateId } from "@chevrotain/core/mail/schema";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });
const AuthRouteError = Schema.Union([UnauthorizedError, AuthServiceError]);
const ProtectedRouteError = Schema.Union([DatabaseError, UnauthorizedError, AuthServiceError]);

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
	}),
);

const metricsGroup = HttpApiGroup.make("metrics").add(HttpApiEndpoint.get("metrics", "/metrics"));

const analyticsGroup = HttpApiGroup.make("analytics")
	.add(
		HttpApiEndpoint.post("ingestEvents", "/t/e", {
			payload: AnalyticsPayload,
			success: SuccessResponse,
		}).middleware(AuthMiddleware),
	)
	.add(
		HttpApiEndpoint.post("reportErrors", "/t/r", {
			payload: ErrorPayload,
			success: SuccessResponse,
			error: RateLimitError,
		}),
	);

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: ProtectedRouteError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: ProtectedRouteError }))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: AuthRouteError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: AuthRouteError }));

const mailGroup = HttpApiGroup.make("mail")
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
	.middleware(AuthMiddleware);

const GmailPushPayload = Schema.Struct({
	message: Schema.optional(
		Schema.Struct({
			data: Schema.optional(Schema.String),
		}),
	),
});

const webhookGroup = HttpApiGroup.make("webhook").add(
	HttpApiEndpoint.post("gmailPush", "/webhook/gmail", {
		payload: GmailPushPayload,
		success: SuccessResponse,
		error: DatabaseError,
	}),
);

export class ChevrotainWebApi extends HttpApi.make("chevrotain-web")
	.add(analyticsGroup)
	.add(mailGroup)
	.add(webhookGroup)
	.prefix("/api") {}

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, metricsGroup, analyticsGroup, zeroGroup, authGroup, mailGroup, webhookGroup)
	.prefix("/api") {}
