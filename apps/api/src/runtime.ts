import { Effect, Layer } from "effect";
import { WorkflowEngine } from "effect/unstable/workflow";

import { registerDatabasePoolMetrics } from "@chevrotain/api/metrics";
import { Analytics } from "@chevrotain/core/analytics/index";
import { Auth } from "@chevrotain/core/auth/index";
import { Database } from "@chevrotain/core/drizzle/index";
import { Email } from "@chevrotain/core/email";
import { MailEncryption } from "@chevrotain/core/mail/encryption";
import { GmailOAuth } from "@chevrotain/core/mail/gmail/oauth";
import { GmailWorkflowsLive } from "@chevrotain/core/mail/gmail/workflows";
import { RateLimit } from "@chevrotain/core/rate-limit";

const DatabasePoolMetricsLive = Layer.effectDiscard(
	Effect.gen(function* () {
		const { db } = yield* Database.Service;
		yield* Effect.sync(() => registerDatabasePoolMetrics(db.$client));
		yield* Effect.addFinalizer(() => Effect.sync(() => registerDatabasePoolMetrics(undefined)));
	}),
).pipe(Layer.provide(Database.defaultLayer));

const BaseLive = Layer.mergeAll(
	Database.defaultLayer,
	Analytics.defaultLayer,
	Email.defaultLayer,
	MailEncryption.defaultLayer,
	GmailOAuth.defaultLayer,
	RateLimit.defaultLayer,
	Auth.defaultLayer,
	DatabasePoolMetricsLive,
	WorkflowEngine.layerMemory,
);

export const AppLayer = GmailWorkflowsLive.pipe(Layer.provideMerge(BaseLive));
