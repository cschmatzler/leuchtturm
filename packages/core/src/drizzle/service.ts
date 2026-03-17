import { PgClient } from "@effect/sql-pg";
import { drizzle, type EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Config, Effect, Layer, ServiceMap } from "effect";
import { types } from "pg";

// Date/time type IDs that should be returned raw (let Drizzle handle parsing).
// See https://orm.drizzle.team/docs/connect-effect-postgres
const RAW_DATE_TYPE_IDS = [1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182];

/** PgClient layer — manages the connection pool lifecycle via acquireRelease. */
export const PgClientLive = Layer.unwrap(
	Effect.gen(function* () {
		const databaseUrl = yield* Config.redacted("DATABASE_URL");
		return PgClient.layer({
			url: databaseUrl,
			types: {
				getTypeParser: (typeId, format) => {
					if (RAW_DATE_TYPE_IDS.includes(typeId)) {
						return (val: unknown) => val;
					}
					return types.getTypeParser(typeId, format);
				},
			},
		});
	}),
);

/** Effect-managed Drizzle database instance backed by @effect/sql-pg connection pool. */
export class DatabaseService extends ServiceMap.Service<
	DatabaseService,
	EffectPgDatabase
>()("DatabaseService") {}

/** Layer that provides DatabaseService by creating a Drizzle instance from the PgClient. */
export const DatabaseServiceLive = Layer.effect(DatabaseService)(
	Effect.gen(function* () {
		const client = yield* PgClient.PgClient;
		return drizzle(client);
	}),
).pipe(Layer.provide(PgClientLive));
