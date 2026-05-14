const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow the void operator. Call promises directly instead of discarding them with void.",
		},
		messages: {
			banned: "Do not use the void operator.",
		},
	},
	create(context) {
		return {
			UnaryExpression(node) {
				if (node.operator !== "void") {
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
		name: "no-void-operator",
	},
	rules: {
		"no-void-operator": rule,
	},
};

export default plugin;
