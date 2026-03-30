import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import {
	assertPolarCustomer,
	buildBillingCustomerSnapshotFromState,
	buildBillingSubscriptionSnapshotFromState,
} from "@chevrotain/core/billing/queries";

const now = new Date("2026-03-30T12:00:00.000Z");

function makeActiveSubscription(id: string) {
	return {
		id,
		createdAt: now,
		modifiedAt: now,
		metadata: {},
		status: "active" as const,
		amount: 1200,
		currency: "USD",
		recurringInterval: "month" as const,
		currentPeriodStart: now,
		currentPeriodEnd: now,
		trialStart: null,
		trialEnd: null,
		cancelAtPeriodEnd: false,
		canceledAt: null,
		startedAt: now,
		endsAt: null,
		productId: "prod_pro",
		discountId: null,
		meters: [],
	};
}

function makeCustomerState() {
	return {
		id: "pol_customer",
		createdAt: now,
		modifiedAt: now,
		metadata: {},
		externalId: "usr_known",
		email: "User@Example.com",
		emailVerified: true,
		name: "Ada",
		billingAddress: null,
		taxId: null,
		organizationId: "org_123",
		deletedAt: null,
		activeSubscriptions: [makeActiveSubscription("sub_1"), makeActiveSubscription("sub_2")],
		grantedBenefits: [],
		activeMeters: [],
		avatarUrl: "https://example.com/avatar.png",
	};
}

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

describe("billing customer state snapshots", () => {
	it("derives subscription counts from the full customer state", () => {
		const userId = `usr_${ulid()}`;
		const snapshot = buildBillingCustomerSnapshotFromState({
			userId,
			state: makeCustomerState(),
		});

		expect(snapshot.userId).toBe(userId);
		expect(snapshot.polarCustomerId).toBe("pol_customer");
		expect(snapshot.email).toBe("user@example.com");
		expect(snapshot.activeSubscriptionsCount).toBe(2);
		expect(snapshot.hasActiveSubscription).toBe(true);
	});

	it("maps active customer-state subscriptions into persisted subscription snapshots", () => {
		const userId = `usr_${ulid()}`;
		const snapshot = buildBillingSubscriptionSnapshotFromState({
			userId,
			polarCustomerId: "pol_customer",
			state: makeActiveSubscription("sub_active"),
		});

		expect(snapshot.id).toBe("sub_active");
		expect(snapshot.userId).toBe(userId);
		expect(snapshot.polarCustomerId).toBe("pol_customer");
		expect(snapshot.status).toBe("active");
		expect(snapshot.endedAt).toBeNull();
	});
});
