import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Effect, Layer, ServiceMap } from "effect";
import { Client as PgClient } from "pg";

import { allRelations } from "@chevrotain/core/drizzle/relations";

export namespace Database {
	export type Client = NodePgDatabase<Record<string, never>, typeof allRelations> & {
		$client: NodePgClient;
	};

	export type Executor = Omit<Client, "$client">;

	export interface Interface {
		readonly db: Client;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Database") {}

	export const layer = (connectionString: string) =>
		Layer.effect(Service)(
			Effect.gen(function* () {
				const client = yield* Effect.acquireRelease(
					Effect.tryPromise({
						try: async () => {
							const client = new PgClient({
								connectionString,
							});
							await client.connect();
							return client;
						},
						catch: (error) =>
							error instanceof globalThis.Error ? error : new globalThis.Error(String(error)),
					}),
					(client) => Effect.promise(() => client.end()),
				);

				return Service.of({
					db: drizzle({
						client,
						relations: allRelations,
					}),
				});
			}),
		);
}
