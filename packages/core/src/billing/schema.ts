import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { Schema } from "effect";

import { OrganizationSelect } from "@leuchtturm/core/auth/schema";
import {
	billingCustomerTable,
	billingOrderTable,
	billingSubscriptionTable,
} from "@leuchtturm/core/billing/billing.sql";
import { Email } from "@leuchtturm/core/schema";

const SubscriptionStatus = Schema.Literals([
	"incomplete",
	"incomplete_expired",
	"trialing",
	"active",
	"past_due",
	"canceled",
	"unpaid",
]);

const RecurringInterval = Schema.Literals(["day", "week", "month", "year"]);

const OrderStatus = Schema.Literals(["pending", "paid", "refunded", "partially_refunded", "void"]);

const OrderBillingReason = Schema.Literals([
	"purchase",
	"subscription_create",
	"subscription_cycle",
	"subscription_update",
]);

const billingCustomerRefinements = {
	organizationId: () => OrganizationSelect.fields.id,
	email: () => Email,
};

export const CustomerInsert = createInsertSchema(billingCustomerTable, billingCustomerRefinements);
export const CustomerUpdate = createUpdateSchema(billingCustomerTable, billingCustomerRefinements);
export const CustomerSelect = createSelectSchema(billingCustomerTable, billingCustomerRefinements);

const billingSubscriptionRefinements = {
	organizationId: () => OrganizationSelect.fields.id,
	status: () => SubscriptionStatus,
	recurringInterval: () => RecurringInterval,
};

export const SubscriptionInsert = createInsertSchema(
	billingSubscriptionTable,
	billingSubscriptionRefinements,
);
export const SubscriptionUpdate = createUpdateSchema(
	billingSubscriptionTable,
	billingSubscriptionRefinements,
);
export const SubscriptionSelect = createSelectSchema(
	billingSubscriptionTable,
	billingSubscriptionRefinements,
);

const billingOrderRefinements = {
	organizationId: () => OrganizationSelect.fields.id,
	status: () => OrderStatus,
	billingReason: () => OrderBillingReason,
};

export const OrderInsert = createInsertSchema(billingOrderTable, billingOrderRefinements);
export const OrderUpdate = createUpdateSchema(billingOrderTable, billingOrderRefinements);
export const OrderSelect = createSelectSchema(billingOrderTable, billingOrderRefinements);
