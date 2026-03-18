import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";
import { DatabaseError, UnauthorizedError } from "@chevrotain/core/errors";

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });

// --- Endpoint groups (passthrough endpoints only) ---
// Analytics and errors are now served via Effect RPC at /api/rpc.

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", {
		success: SuccessResponse,
	}),
);

const metricsGroup = HttpApiGroup.make("metrics").add(HttpApiEndpoint.get("metrics", "/metrics"));

const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query", { error: DatabaseError }))
	.add(HttpApiEndpoint.post("mutate", "/mutate", { error: DatabaseError }))
	.middleware(AuthMiddleware);

const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*", { error: UnauthorizedError }))
	.add(HttpApiEndpoint.post("authPost", "/auth/*", { error: UnauthorizedError }));

// --- Full API ---

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, metricsGroup, zeroGroup, authGroup)
	.prefix("/api") {}
