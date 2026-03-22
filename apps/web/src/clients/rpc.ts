import { Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import { ChevrotainRpcs } from "@chevrotain/api/contract-rpc";
import type { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";

const apiUrl = import.meta.env.VITE_API_URL;

const FetchRequestInitLive = Layer.succeed(FetchHttpClient.RequestInit, {
	credentials: "include",
});

const RpcProtocol = RpcClient.layerProtocolHttp({
	url: `${apiUrl}/api/rpc`,
}).pipe(Layer.provide([FetchHttpClient.layer, FetchRequestInitLive, RpcSerialization.layerNdjson]));

const runtime = ManagedRuntime.make(RpcProtocol);

function logRpcError(method: string) {
	return (error: unknown) => Effect.sync(() => console.error(`[RPC] ${method} failed`, error));
}

export function ingestEvents(payload: AnalyticsPayload): Promise<void> {
	return runtime.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(ChevrotainRpcs);
				yield* client.IngestEvents(payload);
			}),
		).pipe(Effect.tapError(logRpcError("IngestEvents")), Effect.ignore),
	);
}

export function reportErrors(payload: ErrorPayload): Promise<void> {
	return runtime.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(ChevrotainRpcs);
				yield* client.ReportErrors(payload);
			}),
		).pipe(Effect.tapError(logRpcError("ReportErrors")), Effect.ignore),
	);
}
