import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Database } from "@leuchtturm/core/drizzle";
import { schema } from "@leuchtturm/zero/schema";

export namespace ZeroDatabaseProvider {
	export interface Interface {
		readonly databaseProvider: ReturnType<typeof zeroDrizzle<typeof schema, Database.RawDatabase>>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/ZeroDatabaseProvider",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { rawDatabase } = yield* Database.Service;

			return Service.of({
				databaseProvider: zeroDrizzle(schema, rawDatabase),
			});
		}),
	);
}
