function endsWithLive(name) {
	return typeof name === "string" && name.endsWith("Live");
}

function reportIfNeeded(context, node, name) {
	if (!endsWithLive(name)) {
		return;
	}

	context.report({
		node,
		messageId: "banned",
		data: { name },
	});
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow identifiers with a 'Live' suffix.",
		},
		messages: {
			banned: "'{{name}}' should not end with 'Live'. Use a more descriptive name.",
		},
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				if (node.id?.type === "Identifier") {
					reportIfNeeded(context, node.id, node.id.name);
				}
			},
			FunctionDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfNeeded(context, node.id, node.id.name);
				}
			},
			ClassDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfNeeded(context, node.id, node.id.name);
				}
			},
			TSTypeAliasDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfNeeded(context, node.id, node.id.name);
				}
			},
			TSInterfaceDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfNeeded(context, node.id, node.id.name);
				}
			},
			ImportSpecifier(node) {
				if (node.imported?.type === "Identifier") {
					reportIfNeeded(context, node.imported, node.imported.name);
				}

				if (node.local?.type === "Identifier") {
					reportIfNeeded(context, node.local, node.local.name);
				}
			},
			ImportDefaultSpecifier(node) {
				if (node.local?.type === "Identifier") {
					reportIfNeeded(context, node.local, node.local.name);
				}
			},
			ImportNamespaceSpecifier(node) {
				if (node.local?.type === "Identifier") {
					reportIfNeeded(context, node.local, node.local.name);
				}
			},
			ExportSpecifier(node) {
				if (node.local?.type === "Identifier") {
					reportIfNeeded(context, node.local, node.local.name);
				}

				if (node.exported?.type === "Identifier") {
					reportIfNeeded(context, node.exported, node.exported.name);
				}
			},
			MemberExpression(node) {
				if (!node.computed && node.property?.type === "Identifier") {
					reportIfNeeded(context, node.property, node.property.name);
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-live-suffix",
	},
	rules: {
		"no-live-suffix": rule,
	},
};

export default plugin;
