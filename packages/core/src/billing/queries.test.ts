import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { Billing } from "@chevrotain/core/billing";

describe("Billing.assertCustomer", () => {
	it("returns the local user id when the webhook references a known user", () => {
		expect(Effect.runSync(Billing.assertCustomer("subscription", "usr_known", "usr_known"))).toBe(
			"usr_known",
		);
	});

	it("fails when the webhook payload omits the external user id", () => {
		const error = Effect.runSync(
			Billing.assertCustomer("customer state", null, null).pipe(Effect.flip),
		);
		expect(error.message).toBe(
			"Polar customer state webhook payload is missing an external user id",
		);
	});

	it("fails when the webhook references an unknown local user", () => {
		const error = Effect.runSync(
			Billing.assertCustomer("subscription", "usr_missing", null).pipe(Effect.flip),
		);
		expect(error.message).toBe(
			"Polar subscription webhook references unknown local user: usr_missing",
		);
	});
});
