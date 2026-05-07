import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/effect-schema";
import * as Schema from "effect/Schema";

import { OrganizationInsert } from "@leuchtturm/core/auth/schema";
import {
	billingCustomerTable,
	billingOrderTable,
	billingSubscriptionTable,
} from "@leuchtturm/core/billing/billing.sql";
import { Email } from "@leuchtturm/core/schema";

export const CustomerInsert = createInsertSchema(billingCustomerTable, {
	organizationId: () => OrganizationInsert.fields.id,
	email: () => Email,
});
export const CustomerUpdate = createUpdateSchema(billingCustomerTable, {
	organizationId: () => OrganizationInsert.fields.id,
	email: () => Email,
});
export const CustomerSelect = createSelectSchema(billingCustomerTable);

export const SubscriptionInsert = createInsertSchema(billingSubscriptionTable, {
	organizationId: () => OrganizationInsert.fields.id,
	status: () =>
		Schema.Literals([
			"incomplete",
			"incomplete_expired",
			"trialing",
			"active",
			"past_due",
			"canceled",
			"unpaid",
		]),
	recurringInterval: () => Schema.Literals(["day", "week", "month", "year"]),
});
export const SubscriptionUpdate = createUpdateSchema(billingSubscriptionTable, {
	organizationId: () => OrganizationInsert.fields.id,
	status: () =>
		Schema.Literals([
			"incomplete",
			"incomplete_expired",
			"trialing",
			"active",
			"past_due",
			"canceled",
			"unpaid",
		]),
	recurringInterval: () => Schema.Literals(["day", "week", "month", "year"]),
});
export const SubscriptionSelect = createSelectSchema(billingSubscriptionTable);

export const OrderInsert = createInsertSchema(billingOrderTable, {
	organizationId: () => OrganizationInsert.fields.id,
	status: () => Schema.Literals(["pending", "paid", "refunded", "partially_refunded", "void"]),
	billingReason: () =>
		Schema.Literals([
			"purchase",
			"subscription_create",
			"subscription_cycle",
			"subscription_update",
		]),
});
export const OrderUpdate = createUpdateSchema(billingOrderTable, {
	organizationId: () => OrganizationInsert.fields.id,
	status: () => Schema.Literals(["pending", "paid", "refunded", "partially_refunded", "void"]),
	billingReason: () =>
		Schema.Literals([
			"purchase",
			"subscription_create",
			"subscription_cycle",
			"subscription_update",
		]),
});
export const OrderSelect = createSelectSchema(billingOrderTable);
