import { mustGetMutator, mustGetQuery } from "@rocicorp/zero";
import { handleMutateRequest, handleQueryRequest } from "@rocicorp/zero/server";
import { describe, expect, it } from "vite-plus/test";

import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

const TEST_USER_ID = "usr_01ARZ3NDEKTSV4RRFFQ69G5FAV" as never;

describe("zero handlers", () => {
	it("returns an application error payload for unknown queries instead of throwing", async () => {
		const result = await handleQueryRequest(
			(name, args) => {
				const query = mustGetQuery(queries, name);
				return query.fn({ args, ctx: { userId: TEST_USER_ID } });
			},
			schema,
			new Request("http://example.com/api/query", {
				body: JSON.stringify(["transform", [{ args: [], id: "query-1", name: "missing.query" }]]),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(result).toEqual([
			"transformed",
			[
				{
					error: "app",
					id: "query-1",
					message: "Query not found: missing.query",
					name: "missing.query",
				},
			],
		]);
	});

	it("returns an application error payload for unknown mutators instead of throwing", async () => {
		const result = await handleMutateRequest(
			{
				transaction: async (transact: any) =>
					transact(
						{},
						{
							updateClientMutationID: async () => ({ lastMutationID: 1 }),
							writeMutationResult: async () => undefined,
						},
					),
			} as never,
			async (transact) =>
				transact(async (tx, name, args) => {
					const mutator = mustGetMutator(mutators, name);
					return mutator.fn({ tx, ctx: { userId: TEST_USER_ID }, args });
				}),
			new Request("http://example.com/api/mutate?schema=public&appID=web", {
				body: JSON.stringify({
					clientGroupID: "group-1",
					mutations: [
						{
							args: [],
							clientID: "client-1",
							id: 1,
							name: "missing.mutator",
							timestamp: 0,
							type: "custom",
						},
					],
					pushVersion: 1,
					requestID: "request-1",
					schemaVersion: 1,
					timestamp: 0,
				}),
				headers: { "content-type": "application/json" },
				method: "POST",
			}),
		);

		expect(result).toEqual({
			mutations: [
				{
					id: {
						clientID: "client-1",
						id: 1,
					},
					result: {
						error: "app",
						message: "Mutator not found: missing.mutator",
					},
				},
			],
		});
	});
});
