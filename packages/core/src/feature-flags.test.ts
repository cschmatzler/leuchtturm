import { ulid } from "ulid";
import { describe, expect, it } from "vite-plus/test";

import { FeatureFlags } from "@chevrotain/core/feature-flags";

const userId = `usr_${ulid()}`;

describe("FeatureFlags", () => {
	it("lets explicit user overrides win over rollout", () => {
		expect(
			FeatureFlags.logic.evaluate({
				userId,
				flag: {
					key: "new-search",
					rolloutPercentage: 0,
				},
				userOverride: {
					featureFlagKey: "new-search",
					userId,
					enabled: true,
				},
			}),
		).toBe(true);

		expect(
			FeatureFlags.logic.evaluate({
				userId,
				flag: {
					key: "new-search",
					rolloutPercentage: 100,
				},
				userOverride: {
					featureFlagKey: "new-search",
					userId,
					enabled: false,
				},
			}),
		).toBe(false);
	});

	it("uses a stable rollout bucket for percentage enablement", () => {
		const bucket = FeatureFlags.logic.getRolloutBucket("new-search", userId);

		expect(bucket).toBeGreaterThanOrEqual(0);
		expect(bucket).toBeLessThan(100);
		expect(FeatureFlags.logic.getRolloutBucket("new-search", userId)).toBe(bucket);
		expect(
			FeatureFlags.logic.evaluate({
				userId,
				flag: {
					key: "new-search",
					rolloutPercentage: bucket,
				},
			}),
		).toBe(false);
		expect(
			FeatureFlags.logic.evaluate({
				userId,
				flag: {
					key: "new-search",
					rolloutPercentage: Math.min(bucket + 1, 100),
				},
			}),
		).toBe(true);
	});

	it("evaluates all flags for a user into a simple lookup", () => {
		const result = FeatureFlags.logic.evaluateMany({
			userId,
			flags: [
				{ key: "always-on", rolloutPercentage: 100 },
				{ key: "explicit-opt-in", rolloutPercentage: 0 },
			],
			userOverrides: [{ featureFlagKey: "explicit-opt-in", userId, enabled: true }],
		});

		expect(result).toEqual({
			"always-on": true,
			"explicit-opt-in": true,
		});
	});
});
