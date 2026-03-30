function isProcessEnv(node) {
	return (
		node?.type === "MemberExpression" &&
		node.computed === false &&
		node.object?.type === "Identifier" &&
		node.object.name === "process" &&
		node.property?.type === "Identifier" &&
		node.property.name === "env"
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow direct process.env access. Use Effect Config instead.",
		},
		messages: {
			banned: "Do not access process.env directly in this project. Use Effect Config instead.",
		},
	},
	create(context) {
		return {
			MemberExpression(node) {
				if (!isProcessEnv(node)) {
					return;
				}

				context.report({
					node,
					messageId: "banned",
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-process-env",
	},
	rules: {
		"no-process-env": rule,
	},
};

export default plugin;
