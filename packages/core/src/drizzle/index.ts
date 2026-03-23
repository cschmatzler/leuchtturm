import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { Pool } from "pg";

import { authRelations } from "@chevrotain/core/auth/auth.sql";

export type DatabaseClient = NodePgDatabase<Record<string, never>, typeof authRelations> & {
	$client: Pool;
};

export namespace Database {
	export interface Interface {
		readonly db: DatabaseClient;
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
					relations: authRelations,
				}),
			});
		}),
	);

	export const defaultLayer = layer;
}
