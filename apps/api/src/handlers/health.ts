import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";

export const HealthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "health", (handlers) =>
	handlers.handle("healthCheck", () => Effect.succeed({ success: true as const })),
);
