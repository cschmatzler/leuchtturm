import { NodeHttpServer } from "@effect/platform-node";
import { Config, Effect, Layer, ManagedRuntime } from "effect";
import { createServer } from "node:http";

import { ServerLive } from "@chevrotain/api/index";

/** Complete application layer: API + Node HTTP server on the configured port. */
const AppLive = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* Config.number("PORT");
		return ServerLive.pipe(Layer.provide(NodeHttpServer.layer(() => createServer(), { port })));
	}),
);

const runtime = ManagedRuntime.make(AppLive);

// Start the server by running a no-op effect — ManagedRuntime acquires
// the layer (which starts listening) on first use.
await runtime.runPromise(Effect.void);

const port = process.env.PORT;
console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	await runtime.dispose();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
