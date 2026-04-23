import { PgClient } from "@effect/sql-pg";
import { makeWithDefaults, type EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import * as pg from "pg";
import type { CustomTypesConfig } from "pg";

import { relations } from "@leuchtturm/core/drizzle/relations";
import { DatabaseError } from "@leuchtturm/core/errors";

const drizzleTypes: CustomTypesConfig = {
	getTypeParser: (typeId, format) => {
		if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
			return (value: string) => value;
		}

		return pg.types.getTypeParser(typeId, format);
	},
};

export namespace Database {
	export type RawClient = NodePgDatabase<Record<string, never>, typeof relations> & {
		$client: NodePgClient;
	};

	export type Client = EffectPgDatabase<Record<string, never>, typeof relations> & {
		$client: PgClient.PgClient;
	};

	export type Executor = Omit<Client, "$client" | "$cache">;

	export interface Interface {
		readonly rawDatabase: RawClient;
		readonly database: Client;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Database") {}

	export const layer = (connectionString: string) =>
		Layer.effect(Service)(
			Effect.gen(function* () {
				const rawClient = yield* Effect.acquireRelease(
					Effect.tryPromise({
						try: async () => {
							const client = new pg.Client({
								connectionString,
							});
							await client.connect();
							return client;
						},
						catch: (error) =>
							new DatabaseError({
								message: `Failed to connect raw Postgres client: ${(error as Error).message}`,
							}),
					}),
					(client) => Effect.promise(() => client.end()),
				);

				const effectClient = yield* PgClient.make({
					url: Redacted.make(connectionString),
					types: drizzleTypes,
				}).pipe(
					Effect.provide(Reactivity.layer),
					Effect.mapError(
						(error) =>
							new DatabaseError({
								message: `Failed to connect Effect Postgres client: ${(error as Error).message}`,
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
