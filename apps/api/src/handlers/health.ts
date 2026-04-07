import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";

export const HealthHandler = HttpApiBuilder.group(ChevrotainApi, "health", (handlers) =>
	handlers.handle("healthCheck", () => Effect.sync(() => ({ success: true as const }))),
);
