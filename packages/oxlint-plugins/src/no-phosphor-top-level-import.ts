const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow importing Phosphor icons from the top-level @phosphor-icons/react barrel. Import icons from their per-icon modules instead.",
		},
		messages: {
			banned:
				"Do not import from @phosphor-icons/react. Use per-icon imports like @phosphor-icons/react/Check instead.",
		},
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				const source = node.source;
				if (source?.type !== "Literal" || source.value !== "@phosphor-icons/react") {
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
		name: "no-phosphor-top-level-import",
	},
	rules: {
		"no-phosphor-top-level-import": rule,
	},
};

export default plugin;
