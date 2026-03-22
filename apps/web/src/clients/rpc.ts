import { Effect, Layer, ServiceMap } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";

import { ChevrotainRpcs } from "@chevrotain/api/contract-rpc";
import type { AnalyticsPayload, ErrorPayload } from "@chevrotain/core/analytics/schema";
import { makeRunPromise } from "@chevrotain/core/effect/run-service";

const apiUrl = import.meta.env.VITE_API_URL;

const FetchRequestInitLive = Layer.succeed(FetchHttpClient.RequestInit, {
	credentials: "include",
});

const RpcProtocol = RpcClient.layerProtocolHttp({
	url: `${apiUrl}/api/rpc`,
}).pipe(Layer.provide([FetchHttpClient.layer, FetchRequestInitLive, RpcSerialization.layerNdjson]));

function logRpcError(method: string) {
	return (error: unknown) => Effect.sync(() => console.error(`[RPC] ${method} failed`, error));
}

export namespace RpcTransport {
	export interface Interface {
		readonly ingestEvents: (payload: AnalyticsPayload) => Effect.Effect<void>;
		readonly reportErrors: (payload: ErrorPayload) => Effect.Effect<void>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@chevrotain/RpcTransport",
	) {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const client = yield* RpcClient.make(ChevrotainRpcs);

			const ingestEvents = Effect.fn("RpcTransport.ingestEvents")(function* (
				payload: AnalyticsPayload,
			) {
				yield* client
					.IngestEvents(payload)
					.pipe(Effect.tapError(logRpcError("IngestEvents")), Effect.ignore);
			});

			const reportErrors = Effect.fn("RpcTransport.reportErrors")(function* (
				payload: ErrorPayload,
			) {
				yield* client
					.ReportErrors(payload)
					.pipe(Effect.tapError(logRpcError("ReportErrors")), Effect.ignore);
			});

			return Service.of({ ingestEvents, reportErrors });
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(RpcProtocol));

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function ingestEvents(payload: AnalyticsPayload): Promise<void> {
		return runPromise((service) => service.ingestEvents(payload));
	}

	export async function reportErrors(payload: ErrorPayload): Promise<void> {
		return runPromise((service) => service.reportErrors(payload));
	}
}

export const ingestEvents = RpcTransport.ingestEvents;
export const reportErrors = RpcTransport.reportErrors;
