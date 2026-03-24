import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { ChevrotainWebApi } from "@chevrotain/api/contract";

const apiUrl = import.meta.env.VITE_API_URL;

// FetchHttpClient.layer uses layerMergedServices which captures the fiber's
// ServiceMap at layer-build time via Effect.servicesWith.  If RequestInit is
// provided as a *sibling* layer it is invisible during that capture.
//
// By providing RequestInit in the outer context (after the layer pipe step),
// it is present in the ServiceMap when the layer builds, so it gets baked into
// every request the HttpClient makes — even when the returned endpoint effects
// are later run in a bare Effect.runPromise.
export const apiClientPromise = Effect.runPromise(
	HttpApiClient.make(ChevrotainWebApi, {
		baseUrl: apiUrl,
	}).pipe(
		Effect.scoped,
		Effect.provide(FetchHttpClient.layer),
		Effect.provideService(FetchHttpClient.RequestInit, { credentials: "include" as const }),
	),
);
