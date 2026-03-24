import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ChevrotainWebApi } from "@chevrotain/api/contract";

const apiUrl = import.meta.env.VITE_API_URL;

const FetchRequestInitLive = Layer.succeed(FetchHttpClient.RequestInit, {
	credentials: "include",
});

export const apiClientPromise = Effect.runPromise(
	HttpApiClient.make(ChevrotainWebApi, {
		baseUrl: apiUrl,
	}).pipe(Effect.provide([FetchHttpClient.layer, FetchRequestInitLive])),
);
