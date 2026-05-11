import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Database as CoreDatabase } from "@leuchtturm/core/database";
import { schema } from "@leuchtturm/zero/schema";

export namespace ZeroDatabase {
	export interface Interface {
		readonly database: ReturnType<typeof zeroDrizzle<typeof schema, CoreDatabase.RawDatabase>>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/zero/ZeroDatabase",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { rawDatabase } = yield* CoreDatabase.Service;

			return Service.of({
				database: zeroDrizzle(schema, rawDatabase),
			});
		}),
	);
}
