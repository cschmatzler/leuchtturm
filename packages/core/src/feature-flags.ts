import { Effect, Layer, Schema, ServiceMap } from "effect";

import { Database } from "@chevrotain/core/drizzle";
import {
	getFeatureFlag,
	getFeatureFlags,
	getFeatureFlagUserOverride,
	getFeatureFlagUserOverridesForUser,
} from "@chevrotain/core/feature-flags/queries";
import type { FeatureFlag } from "@chevrotain/core/feature-flags/schema";

export namespace FeatureFlags {
	export type FlagLike = Pick<FeatureFlag, "key" | "rolloutPercentage">;

	export interface UserOverrideLike {
		readonly featureFlagKey: string;
		readonly userId: string;
		readonly enabled: boolean;
	}

	export class Error extends Schema.TaggedErrorClass<Error>()(
		"FeatureFlagsError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly getRolloutBucket: (key: string, userId: string) => number;
		readonly evaluate: (options: {
			readonly userId: string;
			readonly flag: FlagLike | undefined;
			readonly userOverride?: UserOverrideLike | undefined;
		}) => boolean;
		readonly evaluateMany: (options: {
			readonly userId: string;
			readonly flags: readonly FlagLike[];
			readonly userOverrides?: readonly UserOverrideLike[];
		}) => Record<string, boolean>;
		readonly isEnabled: (key: string, userId: string) => Effect.Effect<boolean, Error>;
		readonly listForUser: (userId: string) => Effect.Effect<Record<string, boolean>, Error>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@chevrotain/FeatureFlags",
	) {}

	const make = (db?: Database.Executor): Interface => {
		const getRolloutBucket = (key: string, userId: string): number => {
			let hash = 2_166_136_261;

			for (const symbol of `${key}:${userId}`) {
				hash ^= symbol.codePointAt(0) ?? 0;
				hash = Math.imul(hash, 16_777_619);
			}

			return (hash >>> 0) % 100;
		};

		const evaluate: Interface["evaluate"] = ({ flag, userId, userOverride }) => {
			if (!flag) return false;
			if (userOverride?.userId === userId) return userOverride.enabled;
			if (flag.rolloutPercentage >= 100) return true;
			if (flag.rolloutPercentage <= 0) return false;

			return getRolloutBucket(flag.key, userId) < flag.rolloutPercentage;
		};

		const evaluateMany: Interface["evaluateMany"] = ({ flags, userId, userOverrides }) => {
			const overridesByKey = new Map(
				(userOverrides ?? [])
					.filter((override) => override.userId === userId)
					.map((override) => [override.featureFlagKey, override] as const),
			);

			return Object.fromEntries(
				flags.map((flag) => [
					flag.key,
					evaluate({
						userId,
						flag,
						userOverride: overridesByKey.get(flag.key),
					}),
				]),
			);
		};

		const databaseUnavailable = <A>(): Effect.Effect<A, Error> =>
			Effect.fail(
				new Error({
					message: "FeatureFlags database access is unavailable in this runtime",
				}),
			);

		const isEnabled: Interface["isEnabled"] = (key, userId) => {
			if (!db) return databaseUnavailable();

			return Effect.gen(function* () {
				const [flag, userOverride] = yield* Effect.tryPromise({
					try: () =>
						Promise.all([getFeatureFlag(db, key), getFeatureFlagUserOverride(db, key, userId)]),
					catch: (error) =>
						new Error({
							message: `Failed to evaluate feature flag ${key}: ${error instanceof globalThis.Error ? error.message : String(error)}`,
						}),
				});

				return evaluate({
					userId,
					flag,
					userOverride,
				});
			});
		};

		const listForUser: Interface["listForUser"] = (userId) => {
			if (!db) return databaseUnavailable();

			return Effect.gen(function* () {
				const [flags, userOverrides] = yield* Effect.tryPromise({
					try: () =>
						Promise.all([getFeatureFlags(db), getFeatureFlagUserOverridesForUser(db, userId)]),
					catch: (error) =>
						new Error({
							message: `Failed to list feature flags for user ${userId}: ${error instanceof globalThis.Error ? error.message : String(error)}`,
						}),
				});

				return evaluateMany({
					userId,
					flags,
					userOverrides,
				});
			});
		};

		return {
			getRolloutBucket,
			evaluate,
			evaluateMany,
			isEnabled,
			listForUser,
		};
	};

	export const pureLayer = Layer.succeed(Service)(make());

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db } = yield* Database.Service;

			return Service.of(make(db));
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer));
}
