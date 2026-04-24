import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { Cause, Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@leuchtturm/api/auth";
import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Database } from "@leuchtturm/core/drizzle";
import { DatabaseError } from "@leuchtturm/core/errors";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { schema } from "@leuchtturm/zero/schema";

export namespace ZeroHandler {
	const handleQuery = Effect.fn("zero.query")(function* () {
		const { user } = yield* AuthMiddleware.CurrentUser;
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
					return yield* Effect.fail(new DatabaseError({ message: "Query execution failed" }));
				}),
			),
		);

		return yield* HttpServerResponse.json(result).pipe(Effect.orDie);
	});

	const handleMutate = Effect.fn("zero.mutate")(function* () {
		const { user } = yield* AuthMiddleware.CurrentUser;
		const { rawDatabase } = yield* Database.Service;
		const ctx = { userId: user.id };
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
		const databaseProvider = zeroDrizzle(schema, rawDatabase);

		const result = yield* Effect.tryPromise({
			try: () =>
				handleMutateRequest(
					databaseProvider,
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
					return yield* Effect.fail(new DatabaseError({ message: "Mutation execution failed" }));
				}),
			),
		);

		return yield* HttpServerResponse.json(result).pipe(Effect.orDie);
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "zero", (handlers) =>
		handlers.handleRaw("query", handleQuery).handleRaw("mutate", handleMutate),
	);
}
