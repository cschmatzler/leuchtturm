const indexingTools = new Set(["edit", "write"]);
const seenCompletedParts = [];
const seenCompletedPartIds = new Set();
const maxSeenCompletedParts = 200;

let runQueued = false;
let runningIndex;

function rememberCompletedPart(part) {
	const partId = typeof part?.id === "string" ? part.id : undefined;
	if (!partId) return false;
	if (seenCompletedPartIds.has(partId)) return true;

	seenCompletedParts.push(partId);
	seenCompletedPartIds.add(partId);

	if (seenCompletedParts.length > maxSeenCompletedParts) {
		const oldestPartId = seenCompletedParts.shift();
		if (oldestPartId) seenCompletedPartIds.delete(oldestPartId);
	}

	return false;
}

async function runIndex($, directory) {
	await $`cd ${directory} && cog code:index`;
}

function queueIndex($, directory) {
	runQueued = true;
	if (runningIndex) return;

	runningIndex = (async () => {
		while (runQueued) {
			runQueued = false;

			try {
				await runIndex($, directory);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`[cog-auto-index] Failed to run cog code:index: ${message}`);
			}
		}
	})().finally(() => {
		runningIndex = undefined;
	});
}

export const CogAutoIndex = async ({ $, directory }) => {
	return {
		event: async ({ event }) => {
			if (event?.type !== "message.part.updated") return;

			const part = event.properties?.part;
			if (part?.type !== "tool") return;
			if (part?.state?.status !== "completed") return;
			if (!indexingTools.has(part.tool)) return;
			if (rememberCompletedPart(part)) return;

			queueIndex($, directory);
		},
	};
};
