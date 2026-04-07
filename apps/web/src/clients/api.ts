import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ChevrotainWebApi } from "@chevrotain/api/contract";
import { getApiBaseUrl } from "@chevrotain/web/runtime";

const effectApiClient = HttpApiClient.make(ChevrotainWebApi, {
	baseUrl: getApiBaseUrl(),
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

const createApiClient = () => Effect.runPromise(effectApiClient);

type ApiClient = Awaited<ReturnType<typeof createApiClient>>;

async function runApi<A, E>(fn: (api: ApiClient) => Effect.Effect<A, E, never>) {
	return Effect.runPromise(effectApiClient.pipe(Effect.flatMap(fn)));
}

export const apiClient = {
	mail: {
		mailOAuthUrl: () => runApi((api) => api.mail.mailOAuthUrl()),
		mailOAuthCallback: (...args: Parameters<ApiClient["mail"]["mailOAuthCallback"]>) =>
			runApi((api) => api.mail.mailOAuthCallback(...args)),
	},
};
