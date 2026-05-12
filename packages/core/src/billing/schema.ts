import { createSelectSchema } from "drizzle-orm/effect-schema";

import {
	billingCustomerTable,
	billingOrderTable,
	billingSubscriptionTable,
} from "@leuchtturm/core/billing/billing.sql";
export const CustomerSelect = createSelectSchema(billingCustomerTable);

export const SubscriptionSelect = createSelectSchema(billingSubscriptionTable);

export const OrderSelect = createSelectSchema(billingOrderTable);
