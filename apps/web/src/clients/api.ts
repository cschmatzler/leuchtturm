import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ChevrotainWebApi } from "@chevrotain/api/contract";

const apiUrl = import.meta.env.VITE_API_URL;

export const apiClientPromise = Effect.runPromise(
	HttpApiClient.make(ChevrotainWebApi, {
		baseUrl: apiUrl,
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
	),
);
