import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { createServer } from "node:http";

import { ApiPortConfig } from "@chevrotain/api/config";
import { ServerLive } from "@chevrotain/api/index";

const AppLive = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* ApiPortConfig;
		return ServerLive.pipe(Layer.provide(NodeHttpServer.layer(() => createServer(), { port })));
	}),
);

const runtime = ManagedRuntime.make(AppLive);

await runtime.runPromise(Effect.void);

const port = await runtime.runPromise(
	Effect.gen(function* () {
		return yield* ApiPortConfig;
	}),
);
console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	await runtime.dispose();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
