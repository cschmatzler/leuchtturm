import { describe, expect, it } from "vite-plus/test";

import { assertPolarCustomer } from "@chevrotain/core/billing";

describe("assertPolarCustomer", () => {
	it("returns the local user id when the webhook references a known user", () => {
		expect(assertPolarCustomer("subscription", "usr_known", "usr_known")).toBe("usr_known");
	});

	it("throws when the webhook payload omits the external user id", () => {
		expect(() => assertPolarCustomer("customer state", null, null)).toThrow(
			"Polar customer state webhook payload is missing an external user id",
		);
	});

	it("throws when the webhook references an unknown local user", () => {
		expect(() => assertPolarCustomer("subscription", "usr_missing", null)).toThrow(
			"Polar subscription webhook references unknown local user: usr_missing",
		);
	});
});
