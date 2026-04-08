import { and, eq } from "drizzle-orm";

import { type Database } from "@leuchtturm/core/drizzle";
import {
	featureFlag,
	featureFlagUserOverride,
} from "@leuchtturm/core/feature-flags/feature-flags.sql";

export async function getFeatureFlags(
	db: Database.Executor,
): Promise<readonly (typeof featureFlag.$inferSelect)[]> {
	return db.select().from(featureFlag).orderBy(featureFlag.key);
}

export async function getFeatureFlag(
	db: Database.Executor,
	key: string,
): Promise<typeof featureFlag.$inferSelect | undefined> {
	const [row] = await db.select().from(featureFlag).where(eq(featureFlag.key, key)).limit(1);
	return row;
}

export async function getFeatureFlagUserOverridesForUser(
	db: Database.Executor,
	userId: string,
): Promise<readonly (typeof featureFlagUserOverride.$inferSelect)[]> {
	return db
		.select()
		.from(featureFlagUserOverride)
		.where(eq(featureFlagUserOverride.userId, userId));
}

export async function getFeatureFlagUserOverride(
	db: Database.Executor,
	key: string,
	userId: string,
): Promise<typeof featureFlagUserOverride.$inferSelect | undefined> {
	const [row] = await db
		.select()
		.from(featureFlagUserOverride)
		.where(
			and(
				eq(featureFlagUserOverride.featureFlagKey, key),
				eq(featureFlagUserOverride.userId, userId),
			),
		)
		.limit(1);

	return row;
}
