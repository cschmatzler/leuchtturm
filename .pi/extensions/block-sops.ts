import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const sopsCommandPattern = /(^|[;&|()\s"'`])(?:[^\s;&|()"'`]+\/)?sops(?=$|[;&|()\s"'`])/i;
const blockReason = "Blocked: sops commands are disabled in this project";

function containsSopsCommand(command: string): boolean {
	return sopsCommandPattern.test(command);
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		if (!containsSopsCommand(command)) return undefined;

		if (ctx.hasUI) {
			ctx.ui.notify(`Blocked sops command: ${command}`, "warning");
		}

		return { block: true, reason: blockReason };
	});

	pi.on("user_bash", async (event, ctx) => {
		if (!containsSopsCommand(event.command)) return undefined;

		if (ctx.hasUI) {
			ctx.ui.notify(`Blocked sops command: ${event.command}`, "warning");
		}

		return {
			result: {
				output: `${blockReason}\n`,
				exitCode: 126,
				cancelled: false,
				truncated: false,
			},
		};
	});
}
