import {
	boolean,
	char,
	foreignKey,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

import { user } from "@leuchtturm/core/auth/auth.sql";

export const billingCustomer = pgTable(
	"billing_customer",
	{
		userId: char("user_id", { length: 30 })
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		polarCustomerId: text("polar_customer_id").notNull().unique(),
		email: text("email").notNull(),
		name: text("name"),
		deletedAt: timestamp("deleted_at"),
		activeSubscriptionsCount: integer("active_subscriptions_count").default(0).notNull(),
		hasActiveSubscription: boolean("has_active_subscription").default(false).notNull(),
		snapshotJson: text("snapshot_json").notNull(),
		remoteCreatedAt: timestamp("remote_created_at").notNull(),
		remoteModifiedAt: timestamp("remote_modified_at"),
		syncedAt: timestamp("synced_at").notNull(),
	},
	(table) => [
		index("billing_customer_has_active_subscription_idx").on(table.hasActiveSubscription),
		unique("billing_customer_user_polar_customer_uniq").on(table.userId, table.polarCustomerId),
	],
);

export const billingSubscription = pgTable(
	"billing_subscription",
	{
		id: text("id").primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		polarCustomerId: text("polar_customer_id").notNull(),
		productId: text("product_id").notNull(),
		status: text("status").notNull(),
		amount: integer("amount").notNull(),
		currency: text("currency").notNull(),
		recurringInterval: text("recurring_interval").notNull(),
		currentPeriodStart: timestamp("current_period_start").notNull(),
		currentPeriodEnd: timestamp("current_period_end").notNull(),
		trialStart: timestamp("trial_start"),
		trialEnd: timestamp("trial_end"),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull(),
		canceledAt: timestamp("canceled_at"),
		startedAt: timestamp("started_at"),
		endsAt: timestamp("ends_at"),
		endedAt: timestamp("ended_at"),
		snapshotJson: text("snapshot_json").notNull(),
		remoteCreatedAt: timestamp("remote_created_at").notNull(),
		remoteModifiedAt: timestamp("remote_modified_at"),
		syncedAt: timestamp("synced_at").notNull(),
	},
	(table) => [
		index("billing_subscription_user_id_idx").on(table.userId),
		index("billing_subscription_status_idx").on(table.status),
		unique("billing_subscription_id_user_id_uniq").on(table.id, table.userId),
		foreignKey({
			name: "billing_subscription_customer_fkey",
			columns: [table.userId, table.polarCustomerId],
			foreignColumns: [billingCustomer.userId, billingCustomer.polarCustomerId],
		}).onDelete("cascade"),
	],
);

export const billingOrder = pgTable(
	"billing_order",
	{
		id: text("id").primaryKey(),
		userId: char("user_id", { length: 30 }).references(() => user.id, { onDelete: "set null" }),
		polarCustomerId: text("polar_customer_id").notNull(),
		productId: text("product_id"),
		subscriptionId: text("subscription_id"),
		status: text("status").notNull(),
		billingReason: text("billing_reason").notNull(),
		paid: boolean("paid").notNull(),
		currency: text("currency").notNull(),
		subtotalAmount: integer("subtotal_amount").notNull(),
		discountAmount: integer("discount_amount").notNull(),
		netAmount: integer("net_amount").notNull(),
		taxAmount: integer("tax_amount").notNull(),
		totalAmount: integer("total_amount").notNull(),
		refundedAmount: integer("refunded_amount").notNull(),
		dueAmount: integer("due_amount").notNull(),
		snapshotJson: text("snapshot_json").notNull(),
		remoteCreatedAt: timestamp("remote_created_at").notNull(),
		remoteModifiedAt: timestamp("remote_modified_at"),
		syncedAt: timestamp("synced_at").notNull(),
	},
	(table) => [
		index("billing_order_user_id_idx").on(table.userId),
		index("billing_order_subscription_id_idx").on(table.subscriptionId),
		foreignKey({
			name: "billing_order_customer_fkey",
			columns: [table.userId, table.polarCustomerId],
			foreignColumns: [billingCustomer.userId, billingCustomer.polarCustomerId],
		}),
		foreignKey({
			name: "billing_order_subscription_user_fkey",
			columns: [table.subscriptionId, table.userId],
			foreignColumns: [billingSubscription.id, billingSubscription.userId],
		}),
	],
);
