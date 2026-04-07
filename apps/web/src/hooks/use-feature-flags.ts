import { useMemo } from "react";

import { FeatureFlags } from "@chevrotain/core/feature-flags";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { queries } from "@chevrotain/zero/queries";

export function useFeatureFlags(): Record<string, boolean> {
	const [currentUser] = useZeroQuery(queries.currentUser());
	const [flags = []] = useZeroQuery(queries.featureFlags());
	const [featureFlagUserOverrides = []] = useZeroQuery(queries.currentUserFeatureFlagOverrides());

	return useMemo(() => {
		if (!currentUser) return {};

		return FeatureFlags.logic.evaluateMany({
			userId: currentUser.id,
			flags,
			userOverrides: featureFlagUserOverrides,
		});
	}, [currentUser, flags, featureFlagUserOverrides]);
}

export function useFeatureFlag(key: string): boolean {
	const featureFlags = useFeatureFlags();
	return featureFlags[key] ?? false;
}
