import "@chevrotain/api/telemetry-preload";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { createServer } from "node:http";

import { ApiPortConfig } from "@chevrotain/api/config";
import { ServerLive } from "@chevrotain/api/index";
import { ObservabilityLive } from "@chevrotain/api/observability";

const AppLive = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* ApiPortConfig;
		return Layer.mergeAll(
			ServerLive.pipe(Layer.provide(NodeHttpServer.layer(() => createServer(), { port }))),
			ObservabilityLive,
		);
	}),
);

const runtime = ManagedRuntime.make(AppLive);

await runtime.runPromise(Effect.void);

const port = await runtime.runPromise(
	Effect.gen(function* () {
		return yield* ApiPortConfig;
	}),
);

await runtime.runPromise(
	Effect.logInfo("API server running").pipe(
		Effect.annotateLogs("pid", String(process.pid)),
		Effect.annotateLogs("port", String(port)),
	),
);

async function shutdown(signal: string) {
	await runtime.runPromise(
		Effect.logInfo("API server shutting down").pipe(
			Effect.annotateLogs("pid", String(process.pid)),
			Effect.annotateLogs("signal", signal),
		),
	);

	await runtime.dispose();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
