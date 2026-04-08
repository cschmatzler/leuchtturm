import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";

export namespace HealthHandler {
	export const layer = HttpApiBuilder.group(LeuchtturmApi, "health", (handlers) =>
		handlers.handle("healthCheck", () => Effect.sync(() => ({ success: true as const }))),
	);
}
