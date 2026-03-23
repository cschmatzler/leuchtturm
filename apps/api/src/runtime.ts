import { Layer } from "effect";

import { Analytics } from "@chevrotain/core/analytics/index";
import { Auth } from "@chevrotain/core/auth/index";
import { Database } from "@chevrotain/core/drizzle/index";
import { Email } from "@chevrotain/core/email/index";
import { RateLimit } from "@chevrotain/core/rate-limit/index";

export const AppLayer = Layer.mergeAll(
	Database.defaultLayer,
	Analytics.defaultLayer,
	Email.defaultLayer,
	RateLimit.defaultLayer,
	Auth.defaultLayer,
);
