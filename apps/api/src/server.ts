import { serve } from "@hono/node-server";

import { app } from "@one/api/index";
import { shutdownTelemetry } from "@one/api/instrumentation";

const port = Number(process.env.PORT!);
const server = serve({
	port,
	fetch: app.fetch,
});

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	await shutdownTelemetry();
	server.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
