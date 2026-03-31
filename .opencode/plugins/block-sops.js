const sopsCommandPattern = /(^|[;&|()\s"'`])(?:[^\s;&|()"'`]+\/)?sops(?=$|[;&|()\s"'`])/i;
const blockReason = "Blocked: sops commands are disabled in this project";

function containsSopsCommand(command) {
	return sopsCommandPattern.test(command);
}

function getCommand(input, output) {
	const outputCommand = output?.args?.command;
	if (typeof outputCommand === "string") return outputCommand;

	const inputCommand = input?.args?.command;
	if (typeof inputCommand === "string") return inputCommand;

	return undefined;
}

export const BlockSops = async () => {
	return {
		"tool.execute.before": async (input, output) => {
			if (input?.tool !== "bash") return;

			const command = getCommand(input, output);
			if (!command || !containsSopsCommand(command)) return;

			throw new Error(blockReason);
		},
	};
};
