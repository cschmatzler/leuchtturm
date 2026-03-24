function reportRelativeSource(context, node) {
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
}

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
				reportRelativeSource(context, node);
			},
			ExportAllDeclaration(node) {
				reportRelativeSource(context, node);
			},
			ExportNamedDeclaration(node) {
				reportRelativeSource(context, node);
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
