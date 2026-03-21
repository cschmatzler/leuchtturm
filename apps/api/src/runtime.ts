import { Layer } from "effect";

import { ClickHouseServiceLive } from "@chevrotain/core/analytics/service";
import { AuthServiceLive } from "@chevrotain/core/auth/index";
import { NodeDatabaseLive } from "@chevrotain/core/drizzle/index";
import { EmailServiceLive } from "@chevrotain/core/email/service";
import { RateLimitServiceLive } from "@chevrotain/core/rate-limit/service";

export const AppLayer = Layer.mergeAll(
	NodeDatabaseLive,
	ClickHouseServiceLive,
	EmailServiceLive,
	RateLimitServiceLive,
	AuthServiceLive.pipe(Layer.provide(NodeDatabaseLive), Layer.provide(EmailServiceLive)),
);
