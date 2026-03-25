import { mustGetMutator, mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { Effect, Exit } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { recordZeroOperation } from "@chevrotain/api/metrics";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { Database } from "@chevrotain/core/drizzle/index";
import { DatabaseError } from "@chevrotain/core/errors";
import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

const ZERO_REQUEST_OPERATION_NAME = "__request__";

function recordZeroOutcome(
	operation: "query" | "mutate",
	name: string,
	outcome: "ok" | "error",
	startedAt: number,
): void {
	recordZeroOperation(operation, name, outcome, (performance.now() - startedAt) / 1000);
}

export const ZeroHandlerLive = HttpApiBuilder.group(ChevrotainApi, "zero", (handlers) =>
	handlers
		.handleRaw(
			"query",
			Effect.fn("zero.query")(function* () {
				const { user } = yield* CurrentUser;
				yield* Effect.annotateCurrentSpan({
					"enduser.id": user.id,
					"zero.operation": "query",
				});
				const request = yield* HttpServerRequest.HttpServerRequest;
				const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
				const requestStartedAt = performance.now();

				const resultExit = yield* Effect.exit(
					Effect.tryPromise({
						try: () =>
							handleQueryRequest(
								(name: string, args: ReadonlyJSONValue | undefined) => {
									const startedAt = performance.now();

									try {
										const query = mustGetQuery(queries, name);
										const result = query.fn({ args, ctx: { userId: user.id } });
										recordZeroOutcome("query", name, "ok", startedAt);
										return result;
									} catch (error) {
										recordZeroOutcome("query", name, "error", startedAt);
										throw error;
									}
								},
								schema,
								rawRequest,
							),
						catch: (error) =>
							new DatabaseError({
								message: `Query execution failed: ${error instanceof Error ? error.message : String(error)}`,
							}),
					}).pipe(
						Effect.withSpan("zero.handleQueryRequest", {
							attributes: { "zero.operation": "query" },
						}),
					),
				);

				if (Exit.isFailure(resultExit)) {
					recordZeroOutcome("query", ZERO_REQUEST_OPERATION_NAME, "error", requestStartedAt);
					return yield* Effect.failCause(resultExit.cause);
				}

				return HttpServerResponse.jsonUnsafe(resultExit.value);
			}),
		)
		.handleRaw(
			"mutate",
			Effect.fn("zero.mutate")(function* () {
				const { user } = yield* CurrentUser;
				const { db } = yield* Database.Service;
				yield* Effect.annotateCurrentSpan({
					"enduser.id": user.id,
					"zero.operation": "mutate",
				});
				const ctx = { userId: user.id };
				const request = yield* HttpServerRequest.HttpServerRequest;
				const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);
				const dbProvider = zeroDrizzle(schema, db);
				const requestStartedAt = performance.now();

				const resultExit = yield* Effect.exit(
					Effect.tryPromise({
						try: () =>
							handleMutateRequest(
								dbProvider,
								async (transact) =>
									transact(async (tx, name, args) => {
										const startedAt = performance.now();
										return Promise.resolve()
											.then(() => {
												const mutator = mustGetMutator(mutators, name);
												return mutator.fn({ tx, ctx, args });
											})
											.then(
												(result) => {
													recordZeroOutcome("mutate", name, "ok", startedAt);
													return result;
												},
												(error) => {
													recordZeroOutcome("mutate", name, "error", startedAt);
													throw error;
												},
											);
									}),
								rawRequest,
							),
						catch: (error) =>
							new DatabaseError({
								message: `Mutation execution failed: ${error instanceof Error ? error.message : String(error)}`,
							}),
					}).pipe(
						Effect.withSpan("zero.handleMutateRequest", {
							attributes: { "zero.operation": "mutate" },
						}),
					),
				);

				if (Exit.isFailure(resultExit)) {
					recordZeroOutcome("mutate", ZERO_REQUEST_OPERATION_NAME, "error", requestStartedAt);
					return yield* Effect.failCause(resultExit.cause);
				}

				return HttpServerResponse.jsonUnsafe(resultExit.value);
			}),
		),
);
