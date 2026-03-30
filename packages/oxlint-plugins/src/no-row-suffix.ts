function endsWithRow(name) {
	return typeof name === "string" && name.endsWith("Row");
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow variables and types with a 'Row' suffix.",
		},
		messages: {
			banned: "'{{name}}' should not end with 'Row'. Use a more descriptive name.",
		},
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				if (node.id?.type === "Identifier" && endsWithRow(node.id.name)) {
					context.report({
						node: node.id,
						messageId: "banned",
						data: { name: node.id.name },
					});
				}
			},
			TSTypeAliasDeclaration(node) {
				if (node.id?.type === "Identifier" && endsWithRow(node.id.name)) {
					context.report({
						node: node.id,
						messageId: "banned",
						data: { name: node.id.name },
					});
				}
			},
			TSInterfaceDeclaration(node) {
				if (node.id?.type === "Identifier" && endsWithRow(node.id.name)) {
					context.report({
						node: node.id,
						messageId: "banned",
						data: { name: node.id.name },
					});
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-row-suffix",
	},
	rules: {
		"no-row-suffix": rule,
	},
};

export default plugin;
