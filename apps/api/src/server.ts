import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { createServer } from "node:http";

import { stopRateLimitCleanup } from "@chevrotain/api/handlers/errors";
import { ServerLive } from "@chevrotain/api/index";

const port = Number(process.env.PORT);
if (!Number.isFinite(port)) {
	throw new Error("PORT environment variable must be a valid number");
}

/** Complete application layer: API + Node HTTP server on the configured port. */
const AppLive = ServerLive.pipe(
	Layer.provide(NodeHttpServer.layer(() => createServer(), { port })),
);

const runtime = ManagedRuntime.make(AppLive);

// Start the server by running a no-op effect — ManagedRuntime acquires
// the layer (which starts listening) on first use.
await runtime.runPromise(Effect.void);

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	stopRateLimitCleanup();
	await runtime.dispose();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
