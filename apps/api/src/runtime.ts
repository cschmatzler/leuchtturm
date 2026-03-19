import { Layer } from "effect";

import { ClickHouseServiceLive } from "@chevrotain/core/analytics/service";
import { DatabaseServiceLive } from "@chevrotain/core/drizzle/service";
import { EmailServiceLive } from "@chevrotain/core/email/service";
import { RateLimitServiceLive } from "@chevrotain/core/rate-limit/service";

export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	EmailServiceLive,
	RateLimitServiceLive,
);
