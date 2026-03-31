import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { Pool } from "pg";

import { allRelations } from "@chevrotain/core/drizzle/relations";

export namespace Database {
	export type Client = NodePgDatabase<Record<string, never>, typeof allRelations> & {
		$client: Pool;
	};

	export type Executor = Omit<Client, "$client">;

	export interface Interface {
		readonly db: Client;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Database") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const databaseUrl = yield* Config.redacted("DATABASE_URL");
			const pool = yield* Effect.acquireRelease(
				Effect.sync(
					() =>
						new Pool({
							connectionString: Redacted.value(databaseUrl),
						}),
				),
				(pool) => Effect.promise(() => pool.end()),
			);

			return Service.of({
				db: drizzle({
					client: pool,
					relations: allRelations,
				}),
			});
		}),
	);

	export const defaultLayer = layer;
}
