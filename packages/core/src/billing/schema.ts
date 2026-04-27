import { Schema } from "effect";

import { OrganizationId } from "@leuchtturm/core/auth/schema";
import { Email } from "@leuchtturm/core/schema";

const BillingSubscriptionStatus = Schema.Literals([
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
]);

const BillingRecurringInterval = Schema.Literals(["day", "week", "month", "year"]);

const BillingOrderStatus = Schema.Literals([
	"pending",
	"paid",
	"refunded",
	"partially_refunded",
	"void",
]);

const BillingOrderBillingReason = Schema.Literals([
	"purchase",
	"subscription_create",
	"subscription_cycle",
	"subscription_update",
]);

export const BillingCustomerSnapshot = Schema.Struct({
	organizationId: OrganizationId,
	polarCustomerId: Schema.String,
	email: Schema.NullOr(Email),
	name: Schema.NullOr(Schema.String),
	deletedAt: Schema.NullOr(Schema.Date),
	activeSubscriptionsCount: Schema.Number,
	hasActiveSubscription: Schema.Boolean,
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: Schema.NullOr(Schema.Date),
	syncedAt: Schema.Date,
});

export const BillingSubscriptionSnapshot = Schema.Struct({
	id: Schema.String,
	organizationId: OrganizationId,
	polarCustomerId: Schema.String,
	productId: Schema.String,
	status: BillingSubscriptionStatus,
	amount: Schema.Number,
	currency: Schema.String,
	recurringInterval: BillingRecurringInterval,
	currentPeriodStart: Schema.Date,
	currentPeriodEnd: Schema.Date,
	trialStart: Schema.NullOr(Schema.Date),
	trialEnd: Schema.NullOr(Schema.Date),
	cancelAtPeriodEnd: Schema.Boolean,
	canceledAt: Schema.NullOr(Schema.Date),
	startedAt: Schema.NullOr(Schema.Date),
	endsAt: Schema.NullOr(Schema.Date),
	endedAt: Schema.NullOr(Schema.Date),
	snapshotJson: Schema.String,
	remoteCreatedAt: Schema.Date,
	remoteModifiedAt: Schema.NullOr(Schema.Date),
	syncedAt: Schema.Date,
});

export const BillingOrderSnapshot = Schema.Struct({
	id: Schema.String,
	organizationId: Schema.NullOr(OrganizationId),
	polarCustomerId: Schema.String,
	productId: Schema.NullOr(Schema.String),
	subscriptionId: Schema.NullOr(Schema.String),
	status: BillingOrderStatus,
	billingReason: BillingOrderBillingReason,
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
	remoteModifiedAt: Schema.NullOr(Schema.Date),
	syncedAt: Schema.Date,
});
