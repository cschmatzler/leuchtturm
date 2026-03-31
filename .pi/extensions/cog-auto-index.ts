import type { ExtensionAPI, ExtensionContext, ExecResult } from "@mariozechner/pi-coding-agent";

const statusKey = "cog-auto-index";
const maxOutputTail = 4000;
const indexingTools = new Set(["edit", "write"]);

type UiContext = Pick<ExtensionContext, "cwd" | "hasUI" | "ui">;

let latestContext: UiContext | undefined;
let runQueued = false;
let runningIndex: Promise<void> | undefined;
let abortController: AbortController | undefined;

function rememberContext(ctx: UiContext): void {
	latestContext = ctx;
	setStatus();
}

function setStatus(): void {
	const ctx = latestContext;
	if (!ctx?.hasUI) return;

	if (runningIndex) {
		ctx.ui.setStatus(statusKey, runQueued ? "cog code:index (queued)" : "cog code:index");
		return;
	}

	ctx.ui.setStatus(statusKey, runQueued ? "cog code:index queued" : undefined);
}

function getOutputTail(result: ExecResult): string {
	const text = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n").trim();
	return text.length <= maxOutputTail ? text : text.slice(-maxOutputTail);
}

function reportFailure(message: string): void {
	if (latestContext?.hasUI) {
		latestContext.ui.notify(message, "warning");
	}
	process.stderr.write(`[${statusKey}] ${message}\n`);
}

async function runIndex(pi: ExtensionAPI): Promise<void> {
	const ctx = latestContext;
	if (!ctx) return;

	const controller = new AbortController();
	abortController = controller;

	try {
		const result = await pi.exec("cog", ["code:index"], {
			cwd: ctx.cwd,
			signal: controller.signal,
		});

		if (controller.signal.aborted || result.killed) return;
		if (result.code === 0) return;

		const details = getOutputTail(result);
		reportFailure(
			details.length > 0
				? `cog code:index exited with code ${result.code}: ${details}`
				: `cog code:index exited with code ${result.code}`,
		);
	} catch (error) {
		if (controller.signal.aborted) return;

		const message = error instanceof Error ? error.message : String(error);
		reportFailure(`Failed to run cog code:index: ${message}`);
	} finally {
		if (abortController === controller) {
			abortController = undefined;
		}
	}
}

function queueIndex(pi: ExtensionAPI): void {
	runQueued = true;
	setStatus();

	if (runningIndex) return;

	runningIndex = (async () => {
		while (runQueued) {
			runQueued = false;
			setStatus();
			await runIndex(pi);
		}
	})()
		.catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			reportFailure(`Unexpected cog code:index failure: ${message}`);
		})
		.finally(() => {
			runningIndex = undefined;
			setStatus();
		});
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		rememberContext(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		rememberContext(ctx);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		rememberContext(ctx);

		if (event.isError || !indexingTools.has(event.toolName)) return;

		queueIndex(pi);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		rememberContext(ctx);
		runQueued = false;
		abortController?.abort();
		await runningIndex?.catch(() => undefined);
		runningIndex = undefined;
		setStatus();
	});
}
