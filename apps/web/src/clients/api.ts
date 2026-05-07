import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { LeuchtturmApi } from "@leuchtturm/api/contract";

type EffectApi = HttpApiClient.ForApi<typeof LeuchtturmApi>;

type UnwrapResponse<T> = T extends readonly [infer Value, ...Array<unknown>] ? Value : T;

type PromiseApi<T> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => Effect.Effect<unknown, unknown, unknown>
		? (...args: Args) => Promise<UnwrapResponse<Effect.Success<ReturnType<T[K]>>>>
		: T[K] extends object
			? PromiseApi<T[K]>
			: T[K];
};

const effectApi = HttpApiClient.make(LeuchtturmApi, {
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

const getPath = (value: unknown, path: ReadonlyArray<PropertyKey>) => {
	let current = value;

	for (const key of path) {
		current = (current as Record<PropertyKey, unknown>)[key];
	}

	return current;
};

const createApi = (path: ReadonlyArray<PropertyKey> = []): unknown =>
	new Proxy(() => undefined, {
		get: (_, key) => createApi([...path, key]),
		apply: (_, __, args: Array<unknown>) =>
			Effect.runPromise(
				effectApi.pipe(
					Effect.flatMap((api) =>
						(
							getPath(api, path) as (
								...args: Array<unknown>
							) => Effect.Effect<unknown, unknown, never>
						)(...args),
					),
				),
			),
	});

export const api = createApi() as PromiseApi<EffectApi>;
