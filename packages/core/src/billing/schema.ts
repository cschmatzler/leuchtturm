import { Schema } from "effect";

import { UserId } from "@chevrotain/core/auth/schema";

const NullableString = Schema.NullOr(Schema.String);
const NullableDate = Schema.NullOr(Schema.Date);
const NullableUserId = Schema.NullOr(UserId);

export const BillingCustomerSnapshotRow = Schema.Struct({
	userId: UserId,
	polarCustomerId: Schema.String,
	email: Schema.String,
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
	status: Schema.String,
	amount: Schema.Number,
	currency: Schema.String,
	recurringInterval: Schema.String,
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
	status: Schema.String,
	billingReason: Schema.String,
	paid: Schema.Boolean,
	currency: Schema.String,
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
