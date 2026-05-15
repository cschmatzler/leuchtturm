import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { FeatureFlagResult } from "posthog-node";
import { PostHog as PostHogEdge } from "posthog-node/edge";
import { Resource } from "sst/resource/cloudflare";

import { ExecutionContext } from "@leuchtturm/api/execution-context";
import {
	FeatureFlagEvaluationError,
	FeatureFlagProviderRequestError,
} from "@leuchtturm/api/feature-flags/errors";

export namespace Posthog {
	export interface Interface {
		readonly capture: (
			distinctId: string,
			event: string,
			properties?: Record<string, unknown>,
		) => Effect.Effect<void>;
		readonly captureException: (
			error: unknown,
			distinctId: string | undefined,
			properties: Record<string, unknown>,
		) => Effect.Effect<void>;
		readonly getFeatureFlagResult: (
			key: string,
			distinctId: string,
			options?: { readonly sendFeatureFlagEvents?: boolean },
		) => Effect.Effect<
			FeatureFlagResult,
			FeatureFlagEvaluationError | FeatureFlagProviderRequestError
		>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/api/Posthog") {}

	export function create(waitUntil?: (promise: Promise<unknown>) => void) {
		return new PostHogEdge(Resource.PostHogProjectApiKey.value, {
			host: Resource.PostHogHost.value,
			waitUntil,
		});
	}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const executionContext = yield* ExecutionContext.Service;
			const client = create(executionContext.waitUntil);
			const capture = Effect.fn("Posthog.capture")(function* (
				distinctId: string,
				event: string,
				properties: Record<string, unknown> = {},
			) {
				yield* Effect.sync(() => {
					client.capture({ distinctId, event, properties });
				});
			});
			const captureException = Effect.fn("Posthog.captureException")(function* (
				error: unknown,
				distinctId: string | undefined,
				properties: Record<string, unknown>,
			) {
				yield* Effect.sync(() => {
					client.captureException(error, distinctId, properties);
				});
			});
			const getFeatureFlagResult = Effect.fn("Posthog.getFeatureFlagResult")(function* (
				key: string,
				distinctId: string,
				options?: { readonly sendFeatureFlagEvents?: boolean },
			) {
				return yield* Effect.tryPromise({
					try: () => client.getFeatureFlagResult(key, distinctId, options),
					catch: (cause) => cause,
				}).pipe(
					Effect.tapCause((cause) =>
						Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
					),
					Effect.mapError(
						() =>
							new FeatureFlagProviderRequestError({
								operation: `Evaluate feature flag ${key} for user ${distinctId}`,
							}),
					),
					Effect.filterOrFail(
						(result) => result !== undefined,
						() => new FeatureFlagEvaluationError({ key, userId: distinctId }),
					),
				);
			});

			return Service.of({ capture, captureException, getFeatureFlagResult });
		}),
	);
}
