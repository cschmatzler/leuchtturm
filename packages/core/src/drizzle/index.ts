import { defineRelationsPart } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";
import { Pool } from "pg";

import { account, session, user } from "@chevrotain/core/auth/auth.sql";

const authRelations = defineRelationsPart({ user, session, account }, (r) => ({
	user: {
		sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
		accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
	},
	session: {
		user: r.one.user({ from: r.session.userId, to: r.user.id }),
	},
	account: {
		user: r.one.user({ from: r.account.userId, to: r.user.id }),
	},
}));

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
