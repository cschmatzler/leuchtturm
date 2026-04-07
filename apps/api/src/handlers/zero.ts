import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle";
import { DatabaseError } from "@chevrotain/core/errors";
import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

export const ZeroHandler = HttpApiBuilder.group(ChevrotainApi, "zero", (handlers) =>
	handlers
		.handleRaw(
			"query",
			Effect.fn("zero.query")(function* () {
				const { user } = yield* CurrentUser;
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
					catch: (error) =>
						new DatabaseError({
							message: `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				return HttpServerResponse.jsonUnsafe(result);
			}),
		)
		.handleRaw(
			"mutate",
			Effect.fn("zero.mutate")(function* () {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				const ctx = { userId: user.id };
				const request = yield* HttpServerRequest.HttpServerRequest;
				const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
				const dbProvider = zeroDrizzle(schema, db);

				const result = yield* Effect.tryPromise({
					try: () =>
						handleMutateRequest(
							dbProvider,
							async (transact) =>
								transact(async (tx, name, args) => {
									return Promise.resolve().then(() => {
										const mutator = mustGetMutator(mutators, name);
										return mutator.fn({ tx, ctx, args });
									});
								}),
							rawRequest,
						),
					catch: (error) =>
						new DatabaseError({
							message: `Mutation execution failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				return HttpServerResponse.jsonUnsafe(result);
			}),
		),
);
