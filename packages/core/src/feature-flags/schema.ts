import { Schema } from "effect";

import { UserId } from "@chevrotain/core/auth/schema";
import { TrimmedNonEmptyString } from "@chevrotain/core/schema";

export const FeatureFlagKey = TrimmedNonEmptyString;
export type FeatureFlagKey = typeof FeatureFlagKey.Type;

export const FeatureFlagDescription = Schema.NullOr(Schema.String);
export type FeatureFlagDescription = typeof FeatureFlagDescription.Type;

export const FeatureFlagRolloutPercentage = Schema.Number.check(
	Schema.isInt(),
	Schema.isBetween({ minimum: 0, maximum: 100 }),
).annotate({ description: "Rollout percentage must be an integer between 0 and 100" });
export type FeatureFlagRolloutPercentage = typeof FeatureFlagRolloutPercentage.Type;

export const FeatureFlag = Schema.Struct({
	key: FeatureFlagKey,
	description: FeatureFlagDescription,
	rolloutPercentage: FeatureFlagRolloutPercentage,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});
export type FeatureFlag = typeof FeatureFlag.Type;

export const FeatureFlagUserOverride = Schema.Struct({
	featureFlagKey: FeatureFlagKey,
	userId: UserId,
	enabled: Schema.Boolean,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});
export type FeatureFlagUserOverride = typeof FeatureFlagUserOverride.Type;
