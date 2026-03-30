import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const processEnvPattern = /\bprocess\.env\b/;
const processEnvPatternGlobal = /\bprocess\.env\b/g;
const blockReason =
	"Blocked: direct process.env access is not allowed in this project. Use Effect Config instead.";

function countProcessEnv(text: string): number {
	return text.match(processEnvPatternGlobal)?.length ?? 0;
}

function introducesProcessEnv(oldText: string, newText: string): boolean {
	return countProcessEnv(newText) > countProcessEnv(oldText);
}

function patchIntroducesProcessEnv(patch: string): boolean {
	return patch
		.split(/\r?\n/)
		.some(
			(line) => line.startsWith("+") && !line.startsWith("+++") && processEnvPattern.test(line),
		);
}

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		let blocked = false;

		if (event.toolName === "write") {
			blocked = processEnvPattern.test((event.input.content as string) ?? "");
		}

		if (event.toolName === "edit") {
			const patch = event.input.patch as string | undefined;
			const multi = event.input.multi as Array<{ oldText: string; newText: string }> | undefined;
			const oldText = event.input.oldText as string | undefined;
			const newText = event.input.newText as string | undefined;

			blocked = Boolean(
				(patch && patchIntroducesProcessEnv(patch)) ||
				(multi && multi.some((item) => introducesProcessEnv(item.oldText, item.newText))) ||
				(oldText !== undefined && newText !== undefined && introducesProcessEnv(oldText, newText)),
			);
		}

		if (!blocked) {
			return undefined;
		}

		const path = (event.input.path as string | undefined) ?? "<multiple files>";
		if (ctx.hasUI) {
			ctx.ui.notify(`Blocked process.env access in ${path}`, "warning");
		}

		return {
			block: true,
			reason: blockReason,
		};
	});
}
