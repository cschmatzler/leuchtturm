import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import type { Contract } from "@leuchtturm/api/contract";
import { Observability } from "@leuchtturm/api/observability";
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
				handleQueryRequest({
					handler: (name: string, args: ReadonlyJSONValue | undefined) => {
						const query = mustGetQuery(queries, name);
						return query.fn({ args, ctx: { userId: user.id } });
					},
					schema,
					request: rawRequest,
					userID: user.id,
				}),
			catch: (cause) => cause,
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
			),
			Effect.mapError(() => new DatabaseError({ operation: "Query execution failed" })),
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
				handleMutateRequest({
					dbProvider: database,
					handler: async (transact) =>
						transact(async (tx, name, args) => {
							return Promise.resolve().then(() => {
								const mutator = mustGetMutator(mutators, name);
								return mutator.fn({ tx, ctx, args });
							});
						}),
					request: rawRequest,
					userID: user.id,
				}),
			catch: (cause) => cause,
		}).pipe(
			Effect.tapCause((cause) =>
				Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) }),
			),
			Effect.mapError(() => new DatabaseError({ operation: "Mutation execution failed" })),
		);

		return yield* HttpServerResponse.json(result).pipe(Effect.orDie);
	});

	export const layer = (api: Contract.Api) =>
		HttpApiBuilder.group(api, "zero", (handlers) =>
			handlers
				.handleRaw("query", () => handleQuery().pipe(Observability.withAction("zero.query")))
				.handleRaw("mutate", () => handleMutate().pipe(Observability.withAction("zero.mutate"))),
		);
}
