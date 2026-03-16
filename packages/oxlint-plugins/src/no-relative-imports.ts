import type { ImportDeclaration, Plugin, RuleModule } from "@one/oxlint-plugins/types";

const rule: RuleModule = {
	meta: {
		docs: {
			description: "Disallow relative imports. Use @one/* imports instead.",
		},
		type: "problem",
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				const source = (node as ImportDeclaration).source;
				if (source && source.type === "Literal" && typeof source.value === "string") {
					const importPath = source.value;
					if (importPath.startsWith(".")) {
						context.report({
							node,
							message: "Relative imports are not allowed. Use package imports with @one/* instead.",
						});
					}
				}
			},
		};
	},
};

const plugin: Plugin = {
	meta: {
		name: "no-relative-imports",
	},
	rules: {
		"no-relative-imports": rule,
	},
};

export default plugin;
