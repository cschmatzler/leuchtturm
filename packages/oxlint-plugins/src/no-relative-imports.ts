const rule = {
	meta: {
		docs: {
			description: "Disallow relative imports. Use @chevrotain/* imports instead.",
		},
		type: "problem",
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				const source = node.source;
				if (source && source.type === "Literal" && typeof source.value === "string") {
					const importPath = source.value;
					if (importPath.startsWith(".")) {
						context.report({
							node,
							message:
								"Relative imports are not allowed. Use package imports with @chevrotain/* instead.",
						});
					}
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-relative-imports",
	},
	rules: {
		"no-relative-imports": rule,
	},
};

export default plugin;
