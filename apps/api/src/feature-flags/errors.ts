import * as Schema from "effect/Schema";

export class FeatureFlagProviderRequestError extends Schema.TaggedErrorClass<FeatureFlagProviderRequestError>()(
	"FeatureFlagProviderRequestError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {
	static new(params: { readonly operation: string }) {
		return new FeatureFlagProviderRequestError({
			...params,
			message: `Feature flag provider request failed: ${params.operation}.`,
		});
	}
}

export class FeatureFlagEvaluationError extends Schema.TaggedErrorClass<FeatureFlagEvaluationError>()(
	"FeatureFlagEvaluationError",
	{
		key: Schema.String,
		userId: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {
	static new(params: { readonly key: string; readonly userId: string }) {
		return new FeatureFlagEvaluationError({
			...params,
			message: `Feature flag ${params.key} could not be evaluated for user ${params.userId}.`,
		});
	}
}

export const FeatureFlagError = Schema.Union([
	FeatureFlagProviderRequestError,
	FeatureFlagEvaluationError,
]);
