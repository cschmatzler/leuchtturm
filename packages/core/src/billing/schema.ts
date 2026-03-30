import { Schema } from "effect";

import { UserId } from "@chevrotain/core/auth/schema";
import { Email } from "@chevrotain/core/schema";

const NullableString = Schema.NullOr(Schema.String);
const NullableDate = Schema.NullOr(Schema.Date);
const NullableUserId = Schema.NullOr(UserId);

export const BillingCurrency = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/));
export type BillingCurrency = typeof BillingCurrency.Type;

export const BillingSubscriptionStatus = Schema.Literals([
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
]);
export type BillingSubscriptionStatus = typeof BillingSubscriptionStatus.Type;

export const BillingRecurringInterval = Schema.Literals(["day", "week", "month", "year"]);
export type BillingRecurringInterval = typeof BillingRecurringInterval.Type;

export const BillingOrderStatus = Schema.Literals([
	"pending",
	"paid",
	"refunded",
	"partially_refunded",
	"void",
]);
export type BillingOrderStatus = typeof BillingOrderStatus.Type;

export const BillingOrderBillingReason = Schema.Literals([
	"purchase",
	"subscription_create",
	"subscription_cycle",
	"subscription_update",
]);
export type BillingOrderBillingReason = typeof BillingOrderBillingReason.Type;

export const BillingCustomerSnapshotRow = Schema.Struct({
	userId: UserId,
	polarCustomerId: Schema.String,
	email: Email,
	name: NullableString,
	deletedAt: NullableDate,
	activeSubscriptionsCount: Schema.Number,
	hasActiveSubscription: Schema.Boolean,
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: NullableDate,
	syncedAt: Schema.Date,
});

export type BillingCustomerSnapshotRow = typeof BillingCustomerSnapshotRow.Type;

export const BillingSubscriptionSnapshotRow = Schema.Struct({
	id: Schema.String,
	userId: UserId,
	polarCustomerId: Schema.String,
	productId: Schema.String,
	status: BillingSubscriptionStatus,
	amount: Schema.Number,
	currency: BillingCurrency,
	recurringInterval: BillingRecurringInterval,
	currentPeriodStart: Schema.Date,
	currentPeriodEnd: Schema.Date,
	trialStart: NullableDate,
	trialEnd: NullableDate,
	cancelAtPeriodEnd: Schema.Boolean,
	canceledAt: NullableDate,
	startedAt: NullableDate,
	endsAt: NullableDate,
	endedAt: NullableDate,
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: NullableDate,
	syncedAt: Schema.Date,
});

export type BillingSubscriptionSnapshotRow = typeof BillingSubscriptionSnapshotRow.Type;

export const BillingOrderSnapshotRow = Schema.Struct({
	id: Schema.String,
	userId: NullableUserId,
	polarCustomerId: Schema.String,
	productId: NullableString,
	subscriptionId: NullableString,
	status: BillingOrderStatus,
	billingReason: BillingOrderBillingReason,
	paid: Schema.Boolean,
	currency: BillingCurrency,
	subtotalAmount: Schema.Number,
	discountAmount: Schema.Number,
	netAmount: Schema.Number,
	taxAmount: Schema.Number,
	totalAmount: Schema.Number,
	refundedAmount: Schema.Number,
	dueAmount: Schema.Number,
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: NullableDate,
	syncedAt: Schema.Date,
});

export type BillingOrderSnapshotRow = typeof BillingOrderSnapshotRow.Type;
