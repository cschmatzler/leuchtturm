import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ChevrotainWebApi } from "@chevrotain/api/contract";

export const apiClient = HttpApiClient.make(ChevrotainWebApi, {
	baseUrl: import.meta.env.VITE_API_URL,
}).pipe(
	Effect.scoped,
	Effect.provide(
		FetchHttpClient.layer.pipe(
			Layer.provide(
				Layer.succeed(FetchHttpClient.RequestInit, {
					credentials: "include" as const,
				}),
			),
		),
	),
);
