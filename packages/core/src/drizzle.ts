import { PgClient as EffectPgClient } from "@effect/sql-pg";
import { drizzle as drizzleEffect, type EffectPgDatabase } from "drizzle-orm/effect-postgres";
import {
	drizzle as drizzleRaw,
	type NodePgClient,
	type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Context, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { Client as PgClient, type CustomTypesConfig, types as pgTypes } from "pg";

import { relations } from "@leuchtturm/core/drizzle/relations";
import { DatabaseError } from "@leuchtturm/core/errors";

const drizzleTypeParserIds = [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182] as const;

const drizzleTypes: CustomTypesConfig = {
	getTypeParser: (typeId, format) => {
		if (drizzleTypeParserIds.includes(typeId as (typeof drizzleTypeParserIds)[number])) {
			return (value: string) => value;
		}

		return pgTypes.getTypeParser(typeId, format);
	},
};

const toDatabaseError = (message: string) => (error: unknown) =>
	new DatabaseError({
		message: `${message}: ${String(error)}`,
	});

export namespace Database {
	export type RawClient = NodePgDatabase<Record<string, never>, typeof relations> & {
		$client: NodePgClient;
	};

	export type Client = EffectPgDatabase<Record<string, never>, typeof relations> & {
		$client: EffectPgClient.PgClient;
	};

	export type Executor = Omit<Client, "$client" | "$cache">;

	export interface Interface {
		readonly rawDb: RawClient;
		readonly db: Client;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Database") {}

	export const layer = (connectionString: string) =>
		Layer.effect(Service)(
			Effect.gen(function* () {
				const rawClient = yield* Effect.acquireRelease(
					Effect.tryPromise({
						try: async () => {
							const client = new PgClient({
								connectionString,
							});
							await client.connect();
							return client;
						},
						catch: toDatabaseError("Failed to connect raw Postgres client"),
					}),
					(client) => Effect.promise(() => client.end()),
				);

				const effectClient = yield* EffectPgClient.make({
					url: Redacted.make(connectionString),
					types: drizzleTypes,
				}).pipe(
					Effect.provide(Reactivity.layer),
					Effect.mapError(toDatabaseError("Failed to connect Effect Postgres client")),
				);

				return Service.of({
					rawDb: drizzleRaw({
						client: rawClient,
						relations,
					}),
					db: drizzleEffect(effectClient, {
						relations,
					}),
				});
			}),
		);
}
