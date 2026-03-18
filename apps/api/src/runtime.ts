import { Layer } from "effect";

import { ClickHouseServiceLive } from "@chevrotain/core/analytics/service";
import { BillingServiceLive } from "@chevrotain/core/billing/service";
import { DatabaseServiceLive } from "@chevrotain/core/drizzle/service";
import { EmailServiceLive } from "@chevrotain/core/email/service";
import { RateLimitServiceLive } from "@chevrotain/core/rate-limit/service";

/** All service layers composed into the application layer. */
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	BillingServiceLive,
	EmailServiceLive,
	RateLimitServiceLive,
);
