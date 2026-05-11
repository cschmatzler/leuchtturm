import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Session } from "@leuchtturm/api/session";
import { DatabaseError } from "@leuchtturm/core/errors";
import { ZeroDatabase } from "@leuchtturm/zero/database";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { schema } from "@leuchtturm/zero/schema";

export namespace ZeroHandler {
	const handleQuery = Effect.fn("zero.query")(function* () {
		const { user } = yield* Session.Service;
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);

		const result = yield* Effect.tryPromise({
			try: () =>
				handleQueryRequest(
					(name: string, args: ReadonlyJSONValue | undefined) => {
						const query = mustGetQuery(queries, name);
						return query.fn({ args, ctx: { userId: user.id } });
					},
					schema,
					rawRequest,
				),
			catch: (cause) => cause,
		}).pipe(
			Effect.catchCause((cause) =>
				Effect.gen(function* () {
					yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
					return yield* Effect.fail(new DatabaseError({ operation: "Query execution failed" }));
				}),
			),
		);

		return yield* HttpServerResponse.json(result).pipe(Effect.orDie);
	});

	const handleMutate = Effect.fn("zero.mutate")(function* () {
		const { user } = yield* Session.Service;
		const { database } = yield* ZeroDatabase.Service;
		const ctx = { userId: user.id };
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);

		const result = yield* Effect.tryPromise({
			try: () =>
				handleMutateRequest(
					database,
					async (transact) =>
						transact(async (tx, name, args) => {
							return Promise.resolve().then(() => {
								const mutator = mustGetMutator(mutators, name);
								return mutator.fn({ tx, ctx, args });
							});
						}),
					rawRequest,
				),
			catch: (cause) => cause,
		}).pipe(
			Effect.catchCause((cause) =>
				Effect.gen(function* () {
					yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
					return yield* Effect.fail(new DatabaseError({ operation: "Mutation execution failed" }));
				}),
			),
		);

		return yield* HttpServerResponse.json(result).pipe(Effect.orDie);
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "zero", (handlers) =>
		handlers
			.handleRaw("query", () => Metrics.trackAction("zero.query", handleQuery()))
			.handleRaw("mutate", () => Metrics.trackAction("zero.mutate", handleMutate())),
	).pipe(Layer.provide(ZeroDatabase.layer));
}
