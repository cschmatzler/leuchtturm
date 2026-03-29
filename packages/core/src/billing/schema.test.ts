import { Option, Schema } from "effect";
import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import {
	BillingCustomerSnapshotRow,
	BillingOrderSnapshotRow,
	BillingSubscriptionSnapshotRow,
} from "@chevrotain/core/billing/schema";

const userId = `usr_${ulid()}`;
const now = new Date();

describe("billing snapshot schemas", () => {
	it("accepts a persisted customer snapshot", () => {
		const result = Schema.decodeUnknownOption(BillingCustomerSnapshotRow)({
			userId,
			polarCustomerId: "pol_123",
			email: "User@Example.com",
			name: "Ada",
			deletedAt: null,
			activeSubscriptionsCount: 1,
			hasActiveSubscription: true,
			snapshotJson: '{"id":"pol_123"}',
			remoteCreatedAt: now,
			remoteModifiedAt: now,
			syncedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
	});

	it("rejects an invalid local user id", () => {
		const result = Schema.decodeUnknownOption(BillingSubscriptionSnapshotRow)({
			id: "sub_123",
			userId: "not-a-user-id",
			polarCustomerId: "pol_123",
			productId: "prod_123",
			status: "active",
			amount: 1000,
			currency: "USD",
			recurringInterval: "month",
			currentPeriodStart: now,
			currentPeriodEnd: now,
			trialStart: null,
			trialEnd: null,
			cancelAtPeriodEnd: false,
			canceledAt: null,
			startedAt: now,
			endsAt: null,
			endedAt: null,
			snapshotJson: '{"id":"sub_123"}',
			remoteCreatedAt: now,
			remoteModifiedAt: now,
			syncedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});

	it("accepts nullable order ownership for unknown users", () => {
		const result = Schema.decodeUnknownOption(BillingOrderSnapshotRow)({
			id: "ord_123",
			userId: null,
			polarCustomerId: "pol_123",
			productId: null,
			subscriptionId: null,
			status: "paid",
			billingReason: "subscription_cycle",
			paid: true,
			currency: "USD",
			subtotalAmount: 1000,
			discountAmount: 0,
			netAmount: 1000,
			taxAmount: 0,
			totalAmount: 1000,
			refundedAmount: 0,
			dueAmount: 0,
			snapshotJson: '{"id":"ord_123"}',
			remoteCreatedAt: now,
			remoteModifiedAt: null,
			syncedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
	});
});
