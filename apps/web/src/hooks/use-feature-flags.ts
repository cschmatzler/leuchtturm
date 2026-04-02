import { Effect } from "effect";
import { useMemo } from "react";

import { makeRuntime } from "@chevrotain/core/effect/run-service";
import { FeatureFlags } from "@chevrotain/core/feature-flags";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { queries } from "@chevrotain/zero/queries";

const featureFlagsRuntime = makeRuntime(FeatureFlags.Service, FeatureFlags.pureLayer);

export function useFeatureFlags(): Record<string, boolean> {
	const [currentUser] = useZeroQuery(queries.currentUser());
	const [flags = []] = useZeroQuery(queries.featureFlags());
	const [featureFlagUserOverrides = []] = useZeroQuery(queries.currentUserFeatureFlagOverrides());

	return useMemo(() => {
		if (!currentUser) return {};

		return featureFlagsRuntime.runSync((featureFlags) =>
			Effect.succeed(
				featureFlags.evaluateMany({
					userId: currentUser.id,
					flags,
					userOverrides: featureFlagUserOverrides,
				}),
			),
		);
	}, [currentUser, flags, featureFlagUserOverrides]);
}

export function useFeatureFlag(key: string): boolean {
	const featureFlags = useFeatureFlags();
	return featureFlags[key] ?? false;
}
