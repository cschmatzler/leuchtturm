import { drizzle, type NodePgClient, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Effect, Layer, Context } from "effect";
import { Client as PgClient } from "pg";

import { relations } from "@leuchtturm/core/drizzle/relations";
import { DatabaseError } from "@leuchtturm/core/errors";

export namespace Database {
	export type Client = NodePgDatabase<Record<string, never>, typeof relations> & {
		$client: NodePgClient;
	};

	export type Executor = Omit<Client, "$client">;

	export interface Interface {
		readonly db: Client;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Database") {}

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
						catch: (error) => new DatabaseError({ message: String(error) }),
					}),
					(client) => Effect.promise(() => client.end()),
				);

				return Service.of({
					db: drizzle({
						client,
						relations,
					}),
				});
			}),
		);
}
