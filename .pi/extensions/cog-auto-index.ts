import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";

type UiContext = Pick<ExtensionContext, "cwd" | "hasUI" | "ui">;

const statusKey = "cog-auto-index";
const maxOutputTail = 4000;

let running = false;
let queuedRuns = 0;
let latestContext: UiContext | undefined;
let currentChild: ReturnType<typeof spawn> | undefined;

function appendTail(current: string, chunk: Buffer | string): string {
	const next = current + chunk.toString();
	return next.length <= maxOutputTail ? next : next.slice(-maxOutputTail);
}

function setStatus(): void {
	const ctx = latestContext;
	if (!ctx?.hasUI) return;

	if (running) {
		const queued = queuedRuns > 0 ? ` (+${queuedRuns} queued)` : "";
		ctx.ui.setStatus(statusKey, `cog code:index${queued}`);
		return;
	}

	if (queuedRuns > 0) {
		ctx.ui.setStatus(statusKey, `cog code:index queued (${queuedRuns})`);
		return;
	}

	ctx.ui.setStatus(statusKey, undefined);
}

function reportFailure(message: string): void {
	const ctx = latestContext;
	if (ctx?.hasUI) {
		ctx.ui.notify(message, "warning");
	}
	process.stderr.write(`[${statusKey}] ${message}\n`);
}

function startNextRun(): void {
	if (running || queuedRuns === 0 || !latestContext) return;

	running = true;
	queuedRuns -= 1;
	setStatus();

	let stdout = "";
	let stderr = "";

	currentChild = spawn("cog", ["code:index"], {
		cwd: latestContext.cwd,
		env: process.env,
		stdio: ["ignore", "pipe", "pipe"],
	});

	currentChild.stdout?.on("data", (chunk) => {
		stdout = appendTail(stdout, chunk);
	});

	currentChild.stderr?.on("data", (chunk) => {
		stderr = appendTail(stderr, chunk);
	});

	currentChild.on("error", (error) => {
		currentChild = undefined;
		running = false;
		setStatus();
		reportFailure(`Failed to start cog code:index: ${error.message}`);
		startNextRun();
	});

	currentChild.on("close", (code, signal) => {
		currentChild = undefined;
		running = false;
		setStatus();

		if (code !== 0 && signal !== "SIGTERM") {
			const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n").trim();
			reportFailure(
				details.length > 0
					? `cog code:index exited with code ${code}: ${details}`
					: `cog code:index exited with code ${code}`,
			);
		}

		startNextRun();
	});
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		latestContext = ctx;
		setStatus();
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		latestContext = ctx;

		if (event.isError || (event.toolName !== "edit" && event.toolName !== "write")) return;

		queuedRuns += 1;
		setStatus();
		startNextRun();
	});

	pi.on("session_shutdown", async () => {
		queuedRuns = 0;
		running = false;
		currentChild?.kill("SIGTERM");
		currentChild = undefined;
		setStatus();
	});
}
