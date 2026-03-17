import { serve } from "@hono/node-server";

import { stopRateLimitCleanup } from "@chevrotain/api/errors/index";
import { app } from "@chevrotain/api/index";
import { shutdownTelemetry } from "@chevrotain/api/instrumentation";
import { shutdownRuntime } from "@chevrotain/api/runtime";

const port = Number(process.env.PORT!);
const server = serve({
	port,
	fetch: app.fetch,
});

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	server.close();
	stopRateLimitCleanup();
	await shutdownRuntime(); // closes DB pool, ClickHouse client, etc.
	await shutdownTelemetry();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
