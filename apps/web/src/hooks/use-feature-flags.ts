import { useActiveFeatureFlags, useFeatureFlagEnabled } from "@posthog/react";
import { useMemo } from "react";

export function useFeatureFlags(): Record<string, boolean> {
	const activeFeatureFlags = useActiveFeatureFlags();

	return useMemo(
		() => Object.fromEntries(activeFeatureFlags.map((featureFlag) => [featureFlag, true])),
		[activeFeatureFlags],
	);
}

export function useFeatureFlag(key: string): boolean {
	return useFeatureFlagEnabled(key) ?? false;
}
