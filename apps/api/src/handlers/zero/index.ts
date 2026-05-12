import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import type { Contract } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Session } from "@leuchtturm/api/session";
import { DatabaseError } from "@leuchtturm/core/errors";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { schema } from "@leuchtturm/zero/schema";
import { ZeroDatabase } from "@leuchtturm/zero/zero-database";

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

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "zero", (handlers) =>
			handlers
				.handleRaw("query", () =>
					handleQuery().pipe(
						Effect.tap(() => Metrics.action("zero.query", "success")),
						Effect.catchCause((cause) =>
							Metrics.action("zero.query", "failure").pipe(Effect.andThen(Effect.failCause(cause))),
						),
					),
				)
				.handleRaw("mutate", () =>
					handleMutate().pipe(
						Effect.tap(() => Metrics.action("zero.mutate", "success")),
						Effect.catchCause((cause) =>
							Metrics.action("zero.mutate", "failure").pipe(
								Effect.andThen(Effect.failCause(cause)),
							),
						),
					),
				),
		);
}
