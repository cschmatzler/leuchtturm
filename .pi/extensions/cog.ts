// Cog runtime enforcement extension for the Pi coding agent.
// Deployed by `cog init` to .pi/extensions/cog.ts
//
// Hooks into Pi's extension lifecycle to enforce Cog-first code
// exploration and memory workflow conventions.

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const weakRelationPattern = /"relation"\s*:\s*"related_to"/i;
const shortDefinitionPattern = /"definition"\s*:\s*"[^"]{0,31}"/i;
const memoryRecallTools = new Set(["cog_mem_recall"]);
const memoryWriteTools = new Set([
	"cog_mem_learn",
	"cog_mem_associate",
	"cog_mem_refactor",
	"cog_mem_update",
	"cog_mem_deprecate",
]);
const memoryReviewTools = new Set(["cog_mem_list_short_term"]);
const memoryValidationTools = new Set(["cog_mem_reinforce", "cog_mem_verify", "cog_mem_flush"]);
const deepExplorationTools = new Set(["cog_code_explore", "cog_code_query", "grep", "find", "ls"]);

const sessionState = {
	didRecall: false,
	usedMemory: false,
	pendingLearning: false,
	pendingConsolidation: false,
};

type SearchCommandName = "find" | "grep" | "rg";

type ParsedSearchCommand = {
	commandName: SearchCommandName;
	args: string[];
	cwd: string;
};

function getToolName(event: unknown): string {
	if (!event || typeof event !== "object") return "";
	const record = event as Record<string, unknown>;
	if (typeof record.tool === "string") return record.tool;
	if (typeof record.toolName === "string") return record.toolName;
	if (typeof record.name === "string") return record.name;
	return "";
}

function eventText(event: unknown): string {
	try {
		return JSON.stringify(event);
	} catch {
		return "";
	}
}

function getToolInput(event: unknown): Record<string, unknown> {
	if (!event || typeof event !== "object") return {};
	const record = event as Record<string, unknown>;
	if (!record.input || typeof record.input !== "object") return {};
	return record.input as Record<string, unknown>;
}

function getCommandInput(event: unknown): string {
	const input = getToolInput(event);
	return typeof input.command === "string" ? input.command : "";
}

function normalizeToolPath(value: string): string {
	return value.startsWith("@") ? value.slice(1) : value;
}

function tokenizeShell(command: string): string[] {
	const tokens =
		command.match(/&&|\|\||;|\||"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\S+/g) ?? [];
	return tokens.map((token) => {
		if (
			(token.startsWith('"') && token.endsWith('"')) ||
			(token.startsWith("'") && token.endsWith("'"))
		) {
			return token.slice(1, -1);
		}

		if (token.startsWith("`") && token.endsWith("`")) {
			return token.slice(1, -1);
		}

		return token;
	});
}

function resolveToolPath(value: string, cwd: string): string {
	const normalized = normalizeToolPath(value);
	return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

function normalizePaths(values: string[], cwd: string, existingOnly = false): string[] {
	const targets = new Set<string>();

	for (const value of values) {
		const resolved = resolveToolPath(value, cwd);
		if (!existingOnly || existsSync(resolved)) {
			targets.add(resolved);
		}
	}

	return [...targets];
}

function normalizeSearchPaths(values: string[], cwd: string): string[] {
	const targets = new Set<string>();

	for (const value of values) {
		const resolved = resolveToolPath(value, cwd);
		if (isAbsolute(normalizeToolPath(value)) || existsSync(resolved)) {
			targets.add(resolved);
		}
	}

	return [...targets];
}

function isShellAssignment(token: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(token);
}

function isShellSeparator(token: string): boolean {
	return token === "&&" || token === "||" || token === ";" || token === "|";
}

function resolveDirectory(value: string, cwd: string): string | null {
	const resolved = resolveToolPath(value, cwd);
	return existsSync(resolved) ? resolved : null;
}

function splitShellCommands(
	command: string,
	cwd: string,
): Array<{ cwd: string; tokens: string[] }> {
	const segments: Array<{ cwd: string; tokens: string[] }> = [];
	let currentCwd = cwd;
	let segmentCwd = cwd;
	let segmentTokens: string[] = [];

	const flushSegment = () => {
		if (segmentTokens.length === 0) return;
		segments.push({ cwd: segmentCwd, tokens: [...segmentTokens] });
		segmentTokens = [];
	};

	for (const token of tokenizeShell(command)) {
		if (!isShellSeparator(token)) {
			segmentTokens.push(token);
			continue;
		}

		flushSegment();

		if (
			(token === "&&" || token === ";") &&
			segments.at(-1)?.tokens[0] === "cd" &&
			segments.at(-1)?.tokens[1]
		) {
			const nextCwd = resolveDirectory(segments.at(-1)!.tokens[1], segments.at(-1)!.cwd);
			if (nextCwd) currentCwd = nextCwd;
		}

		segmentCwd = currentCwd;
	}

	flushSegment();
	return segments;
}

function searchOptionConsumesNextToken(commandName: string, token: string): boolean {
	if (token.includes("=")) return false;

	const commonOptions = new Set([
		"-A",
		"-B",
		"-C",
		"-D",
		"-e",
		"-f",
		"-m",
		"--after-context",
		"--before-context",
		"--binary-files",
		"--context",
		"--directories",
		"--exclude",
		"--exclude-dir",
		"--file",
		"--include",
		"--label",
		"--max-count",
	]);
	if (commonOptions.has(token)) return true;

	if (commandName === "rg") {
		return new Set([
			"-g",
			"-j",
			"-M",
			"--glob",
			"--iglob",
			"--max-columns",
			"--max-depth",
			"--max-filesize",
			"--path-separator",
			"--pre",
			"--pre-glob",
			"--regex-size-limit",
			"--sort",
			"--sortr",
		]).has(token);
	}

	return false;
}

function envOptionConsumesNextToken(token: string): boolean {
	if (token.includes("=")) return false;

	return new Set(["-C", "-S", "-u", "--chdir", "--split-string", "--unset"]).has(token);
}

function gitOptionConsumesNextToken(token: string): boolean {
	if (token.includes("=")) return false;

	return new Set([
		"-C",
		"-P",
		"-c",
		"--config-env",
		"--exec-path",
		"--git-dir",
		"--namespace",
		"--super-prefix",
		"--work-tree",
	]).has(token);
}

function unwrapShellCommand(
	tokens: string[],
	cwd: string,
): { tokens: string[]; cwd: string } | null {
	let index = 0;
	let commandCwd = cwd;

	while (index < tokens.length && isShellAssignment(tokens[index]!)) {
		index += 1;
	}

	if (tokens[index] !== "env") {
		return { tokens: tokens.slice(index), cwd: commandCwd };
	}

	index += 1;

	while (index < tokens.length) {
		const token = tokens[index]!;

		if (token === "--") {
			index += 1;
			break;
		}

		if (isShellAssignment(token)) {
			index += 1;
			continue;
		}

		if (token.startsWith("--chdir=")) {
			commandCwd = resolveToolPath(token.slice("--chdir=".length), commandCwd);
			index += 1;
			continue;
		}

		if (!token.startsWith("-")) break;

		if (envOptionConsumesNextToken(token)) {
			const optionValue = tokens[index + 1];
			if (optionValue === undefined) return null;

			if (token === "-C" || token === "--chdir") {
				commandCwd = resolveToolPath(optionValue, commandCwd);
			}

			index += 2;
			continue;
		}

		index += 1;
	}

	while (index < tokens.length && isShellAssignment(tokens[index]!)) {
		index += 1;
	}

	return { tokens: tokens.slice(index), cwd: commandCwd };
}

function parseSearchCommand(tokens: string[], cwd: string): ParsedSearchCommand | null {
	const unwrapped = unwrapShellCommand(tokens, cwd);
	if (!unwrapped || unwrapped.tokens.length === 0) return null;

	const [commandName, ...args] = unwrapped.tokens;
	if (commandName === "find" || commandName === "grep" || commandName === "rg") {
		return { commandName, args, cwd: unwrapped.cwd };
	}

	if (commandName !== "git") return null;

	let commandCwd = unwrapped.cwd;
	let index = 1;

	while (index < unwrapped.tokens.length) {
		const token = unwrapped.tokens[index]!;

		if (token === "grep") {
			return {
				commandName: "grep",
				args: unwrapped.tokens.slice(index + 1),
				cwd: commandCwd,
			};
		}

		if (token === "--") {
			index += 1;
			break;
		}

		if (token.startsWith("--work-tree=")) {
			commandCwd = resolveToolPath(token.slice("--work-tree=".length), commandCwd);
			index += 1;
			continue;
		}

		if (token.startsWith("--git-dir=")) {
			index += 1;
			continue;
		}

		if (!token.startsWith("-")) return null;

		if (gitOptionConsumesNextToken(token)) {
			const optionValue = unwrapped.tokens[index + 1];
			if (optionValue === undefined) return null;

			if (token === "-C" || token === "--work-tree") {
				commandCwd = resolveToolPath(optionValue, commandCwd);
			}

			index += 2;
			continue;
		}

		index += 1;
	}

	return null;
}

export function getSearchTargetsForTokens(tokens: string[], cwd: string): string[] | null {
	const parsedCommand = parseSearchCommand(tokens, cwd);
	if (!parsedCommand) return null;

	if (parsedCommand.commandName === "find") {
		const roots: string[] = [];
		for (const token of parsedCommand.args) {
			if (!token || token === "--") continue;
			if (token.startsWith("-") || token === "!" || token === "(" || token === ")") break;
			roots.push(token);
		}
		return roots.length > 0 ? normalizeSearchPaths(roots, parsedCommand.cwd) : [parsedCommand.cwd];
	}

	let sawPattern = false;
	let afterDoubleDash = false;
	let skipNextToken = false;
	const roots: string[] = [];

	for (const token of parsedCommand.args) {
		if (!token) continue;
		if (skipNextToken) {
			skipNextToken = false;
			continue;
		}
		if (token === "--") {
			afterDoubleDash = true;
			continue;
		}
		if (!afterDoubleDash && token.startsWith("-")) {
			skipNextToken = searchOptionConsumesNextToken(parsedCommand.commandName, token);
			continue;
		}
		if (!sawPattern) {
			sawPattern = true;
			continue;
		}
		roots.push(token);
	}

	return roots.length > 0 ? normalizeSearchPaths(roots, parsedCommand.cwd) : [parsedCommand.cwd];
}

function collectStringValues(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap((item) => collectStringValues(item));
	return [];
}

function collectPathLikeValues(value: unknown, pathLikeKeys: RegExp): string[] {
	if (Array.isArray(value))
		return value.flatMap((item) => collectPathLikeValues(item, pathLikeKeys));
	if (!value || typeof value !== "object") return [];

	return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
		if (pathLikeKeys.test(key)) return collectStringValues(nestedValue);
		return collectPathLikeValues(nestedValue, pathLikeKeys);
	});
}

function isWithinCwd(path: string, cwd: string): boolean {
	const rel = relative(cwd, path);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isGitIgnored(path: string, cwd: string): boolean {
	try {
		execFileSync("git", ["check-ignore", "-q", path], {
			cwd,
			stdio: "ignore",
		});
		return true;
	} catch (error) {
		const status =
			typeof error === "object" && error && "status" in error
				? (error.status as number | null)
				: null;
		if (status === 1 || status === 128) return false;
		return false;
	}
}

export function areSearchTargetsIndexed(command: string, cwd: string): boolean {
	for (const segment of splitShellCommands(command, cwd)) {
		const targets = getSearchTargetsForTokens(segment.tokens, segment.cwd);
		if (!targets) continue;

		if (targets.some((target) => isWithinCwd(target, cwd) && !isGitIgnored(target, cwd))) {
			return true;
		}
	}

	return false;
}

function getExplicitToolTargets(event: unknown, cwd: string): string[] {
	const pathLikeKeys = /path|paths|file|files|dir|dirs|directory|directories|root|cwd/i;
	const input = getToolInput(event);
	const values = collectPathLikeValues(input, pathLikeKeys);

	return normalizePaths(values, cwd);
}

function areToolTargetsIndexed(event: unknown, ctx: ExtensionContext): boolean {
	const targets = getExplicitToolTargets(event, ctx.cwd);
	if (targets.length === 0) return true;

	return targets.some((target) => isWithinCwd(target, ctx.cwd) && !isGitIgnored(target, ctx.cwd));
}

function shouldApplySearchPolicy(event: unknown, ctx: ExtensionContext): boolean {
	const command = getCommandInput(event);
	if (!command) return false;
	return areSearchTargetsIndexed(command, ctx.cwd);
}

function shouldAdviseDeepExploration(event: unknown, ctx: ExtensionContext): boolean {
	const toolName = getToolName(event);
	if (!deepExplorationTools.has(toolName)) return false;

	if (toolName === "bash") {
		const command = getCommandInput(event);
		if (!command) return false;
		return areSearchTargetsIndexed(command, ctx.cwd);
	}

	return areToolTargetsIndexed(event, ctx);
}

export default function activate(ctx: ExtensionContext) {
	ctx.on("session_start", () => {
		sessionState.didRecall = false;
		sessionState.usedMemory = false;
		sessionState.pendingLearning = false;
		sessionState.pendingConsolidation = false;
	});

	ctx.on("tool_call", (event) => {
		const toolName = getToolName(event);
		const text = eventText(event);

		// Advisory: recall before deep exploration
		if (!sessionState.didRecall && shouldAdviseDeepExploration(event, ctx)) {
			process.stderr.write(
				"Cog memory workflow: use cog_mem_recall before broad code exploration so recalled knowledge can inform your search.\n",
			);
		}

		// Block shell search commands when Cog code intelligence is available
		if (toolName === "bash") {
			if (shouldApplySearchPolicy(event, ctx)) {
				return {
					block: true,
					reason:
						"Cog policy: use Cog code intelligence tools (cog_code_explore, cog_code_query) before shell search commands like grep, rg, find, or git grep.",
				};
			}
		}

		// Advisory: consolidate before finishing
		if (
			(sessionState.pendingLearning || sessionState.pendingConsolidation) &&
			!memoryWriteTools.has(toolName) &&
			!memoryReviewTools.has(toolName) &&
			!memoryValidationTools.has(toolName)
		) {
			process.stderr.write(
				"Cog memory workflow: remember to store durable knowledge via cog_mem_learn and consolidate short-term memories before finishing.\n",
			);
		}

		// Memory write quality advisories
		if (memoryWriteTools.has(toolName)) {
			if (weakRelationPattern.test(text)) {
				process.stderr.write(
					"Cog memory quality: prefer a stronger predicate than related_to when the relationship is directional or structural.\n",
				);
			}
			if (shortDefinitionPattern.test(text)) {
				process.stderr.write(
					"Cog memory quality: include rationale or constraints when the memory is durable.\n",
				);
			}
		}
	});

	ctx.on("tool_result", (event) => {
		const toolName = getToolName(event);

		if (memoryRecallTools.has(toolName)) {
			sessionState.didRecall = true;
			sessionState.usedMemory = true;
			return;
		}

		if (toolName === "cog_code_explore") {
			sessionState.pendingLearning = true;
			return;
		}

		if (memoryWriteTools.has(toolName)) {
			sessionState.usedMemory = true;
			sessionState.pendingLearning = false;
			sessionState.pendingConsolidation = true;
			return;
		}

		if (memoryReviewTools.has(toolName) || memoryValidationTools.has(toolName)) {
			sessionState.usedMemory = true;
			sessionState.pendingConsolidation = false;
			return;
		}
	});
}
