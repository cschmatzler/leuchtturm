import { PgClient } from "@effect/sql-pg";
import { makeWithDefaults, type EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { Client, types, type CustomTypesConfig } from "pg";

import { authRelations } from "@leuchtturm/core/auth/auth.sql";
import { billingRelations } from "@leuchtturm/core/billing/billing.sql";
import { DatabaseError } from "@leuchtturm/core/errors";

const drizzleTypes: CustomTypesConfig = {
	getTypeParser: (typeId, format) => {
		if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
			return (value: string) => value;
		}

		return types.getTypeParser(typeId, format);
	},
};

export namespace Database {
	export const relations = {
		...authRelations,
		...billingRelations,
		organization: {
			...authRelations.organization,
			relations: {
				...authRelations.organization.relations,
				...billingRelations.organization.relations,
			},
		},
	};

	export type RawDatabase = NodePgDatabase<typeof relations> & {
		$client: NodePgClient;
	};

	export type Database = EffectPgDatabase<typeof relations> & {
		$client: PgClient.PgClient;
	};

	export type Executor = Omit<Database, "$client" | "$cache">;

	export interface Interface {
		readonly rawDatabase: RawDatabase;
		readonly database: Database;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Database") {}

	export function layer(connectionString: string) {
		return Layer.effect(Service)(
			Effect.gen(function* () {
				const rawClient = yield* Effect.acquireRelease(
					Effect.tryPromise({
						try: async () => {
							const client = new Client({
								connectionString,
							});
							await client.connect();
							return client;
						},
						catch: (cause) => cause,
					}).pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
								return yield* Effect.fail(
									new DatabaseError({ operation: "Failed to connect raw Postgres client" }),
								);
							}),
						),
					),
					(client) => Effect.promise(() => client.end()),
				);

				const effectClient = yield* PgClient.make({
					url: Redacted.make(connectionString),
					types: drizzleTypes,
				}).pipe(
					Effect.provide(Reactivity.layer),
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new DatabaseError({ operation: "Failed to connect Effect Postgres client" }),
							);
						}),
					),
				);

				const database = yield* makeWithDefaults({
					relations,
				}).pipe(Effect.provideService(PgClient.PgClient, effectClient));

				return Service.of({
					rawDatabase: drizzle({
						client: rawClient,
						relations,
					}),
					database,
				});
			}),
		);
	}
}
