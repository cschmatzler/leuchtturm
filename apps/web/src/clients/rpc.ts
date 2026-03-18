import { Effect, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import { ChevrotainRpcs } from "@chevrotain/api/contract-rpc";
import type { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";

const apiUrl = import.meta.env.VITE_API_URL;

/**
 * Configure FetchHttpClient with credentials: "include" for cookie-based auth.
 */
const FetchRequestInitLive = Layer.succeed(FetchHttpClient.RequestInit, {
	credentials: "include",
});

/**
 * RPC client protocol layer.
 *
 * Uses HTTP transport pointing at /api/rpc with NDJSON serialization.
 * FetchHttpClient is configured with credentials for cookie auth.
 */
const RpcProtocol = RpcClient.layerProtocolHttp({
	url: `${apiUrl}/api/rpc`,
}).pipe(Layer.provide([FetchHttpClient.layer, FetchRequestInitLive, RpcSerialization.layerNdjson]));

/**
 * Managed runtime providing the RPC protocol. Created once, reused for all calls.
 */
const runtime = ManagedRuntime.make(RpcProtocol);

/**
 * Ingest analytics events via RPC. Returns a promise for compatibility
 * with the existing imperative analytics buffering system.
 */
export function ingestEvents(payload: AnalyticsPayload): Promise<void> {
	return runtime.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(ChevrotainRpcs);
				yield* client.IngestEvents(payload);
			}),
		).pipe(Effect.ignore),
	);
}

/**
 * Report errors via RPC. Returns a promise for compatibility
 * with the existing imperative error reporting system.
 */
export function reportErrors(payload: ErrorPayload): Promise<void> {
	return runtime.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(ChevrotainRpcs);
				yield* client.ReportErrors(payload);
			}),
		).pipe(Effect.ignore),
	);
}
