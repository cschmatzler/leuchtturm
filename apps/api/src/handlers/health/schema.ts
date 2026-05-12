import * as Schema from "effect/Schema";

export namespace HealthSchema {
	export const SuccessResponse = Schema.Struct({
		success: Schema.Literal(true),
		database: Schema.Struct({
			status: Schema.Literal("up"),
			latencyMs: Schema.Number,
		}),
		totalTimeMs: Schema.Number,
	});
}
