import {
	boolean,
	char,
	foreignKey,
	index,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "@chevrotain/core/auth/auth.sql";

export const featureFlag = pgTable(
	"feature_flag",
	{
		key: text("key").primaryKey(),
		description: text("description"),
		rolloutPercentage: smallint("rollout_percentage").notNull().default(100),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("feature_flag_rollout_percentage_idx").on(table.rolloutPercentage)],
);

export const featureFlagUserOverride = pgTable(
	"feature_flag_user_override",
	{
		featureFlagKey: text("feature_flag_key").notNull(),
		userId: char("user_id", { length: 30 }).notNull(),
		enabled: boolean("enabled").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		primaryKey({
			name: "feature_flag_user_override_pkey",
			columns: [table.featureFlagKey, table.userId],
		}),
		index("feature_flag_user_override_user_id_idx").on(table.userId),
		index("feature_flag_user_override_feature_flag_key_idx").on(table.featureFlagKey),
		foreignKey({
			name: "feature_flag_user_override_feature_flag_fkey",
			columns: [table.featureFlagKey],
			foreignColumns: [featureFlag.key],
		}).onDelete("cascade"),
		foreignKey({
			name: "feature_flag_user_override_user_fkey",
			columns: [table.userId],
			foreignColumns: [user.id],
		}).onDelete("cascade"),
	],
);
