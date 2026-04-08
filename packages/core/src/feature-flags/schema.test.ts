import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { FeatureFlag, FeatureFlagUserOverride } from "@leuchtturm/core/feature-flags/schema";

const now = new Date();
const userId = "usr_01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("feature flags", () => {
	it("accepts persisted feature flag records with rollout percentages in range", () => {
		const result = Schema.decodeUnknownOption(FeatureFlag)({
			key: "new-search",
			description: "Roll out the new search experience",
			rolloutPercentage: 25,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
	});

	it("rejects rollout percentages outside the supported range", () => {
		const result = Schema.decodeUnknownOption(FeatureFlag)({
			key: "new-search",
			description: null,
			rolloutPercentage: 101,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isNone(result)).toBe(true);
	});

	it("accepts explicit user overrides", () => {
		const result = Schema.decodeUnknownOption(FeatureFlagUserOverride)({
			featureFlagKey: "new-search",
			userId,
			enabled: true,
			createdAt: now,
			updatedAt: now,
		});

		expect(Option.isSome(result)).toBe(true);
	});
});
