import { Schema } from "effect";

import { OrganizationId } from "@leuchtturm/core/auth/schema";
import { Email } from "@leuchtturm/core/schema";

const NullableString = Schema.NullOr(Schema.String);
const NullableDate = Schema.NullOr(Schema.Date);
const NullableEmail = Schema.NullOr(Email);
const NullableOrganizationId = Schema.NullOr(OrganizationId);

export const BillingCurrency = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/));

export const BillingSubscriptionStatus = Schema.Literals([
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
]);

export const BillingRecurringInterval = Schema.Literals(["day", "week", "month", "year"]);

export const BillingOrderStatus = Schema.Literals([
	"pending",
	"paid",
	"refunded",
	"partially_refunded",
	"void",
]);

export const BillingOrderBillingReason = Schema.Literals([
	"purchase",
	"subscription_create",
	"subscription_cycle",
	"subscription_update",
]);

export const BillingCustomerSnapshot = Schema.Struct({
	organizationId: OrganizationId,
	polarCustomerId: Schema.String,
	email: NullableEmail,
	name: NullableString,
	deletedAt: NullableDate,
	activeSubscriptionsCount: Schema.Number,
	hasActiveSubscription: Schema.Boolean,
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: NullableDate,
	syncedAt: Schema.Date,
});

export const BillingSubscriptionSnapshot = Schema.Struct({
	id: Schema.String,
	organizationId: OrganizationId,
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

export const BillingOrderSnapshot = Schema.Struct({
	id: Schema.String,
	organizationId: NullableOrganizationId,
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
