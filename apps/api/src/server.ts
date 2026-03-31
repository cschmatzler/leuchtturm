import "@chevrotain/api/telemetry-preload";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { createServer } from "node:http";

import { ServerLive } from "@chevrotain/api/index";
import { ObservabilityLive } from "@chevrotain/api/observability";
import { Config } from "@chevrotain/core/config";

const AppLive = Layer.unwrap(
	Effect.gen(function* () {
		const config = yield* Config;
		const { port } = config.api;

		return Layer.mergeAll(
			ServerLive.pipe(Layer.provide(NodeHttpServer.layer(() => createServer(), { port }))),
			ObservabilityLive,
			Layer.effectDiscard(
				Effect.logInfo("API server running").pipe(
					Effect.annotateLogs("pid", String(process.pid)),
					Effect.annotateLogs("port", String(port)),
				),
			),
		);
	}),
);

NodeRuntime.runMain(AppLive.pipe(Layer.launch, Effect.scoped));
