import { serve } from "@hono/node-server";

import { stopRateLimitCleanup } from "@one/api/errors/index";
import { app } from "@one/api/index";
import { shutdownTelemetry } from "@one/api/instrumentation";
import { shutdownRuntime } from "@one/api/runtime";

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
