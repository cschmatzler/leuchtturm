function getFilename(context) {
	return context.filename ?? context.getFilename?.() ?? "";
}

function isCoreFile(filename) {
	return filename.includes("/packages/core/") || filename.startsWith("packages/core/");
}

function endsWithResponse(name) {
	return typeof name === "string" && name.endsWith("Response");
}

function reportIfResponse(context, node, name) {
	if (!endsWithResponse(name)) {
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
			description: "Disallow API response-shaped declarations in packages/core.",
		},
		messages: {
			banned:
				"'{{name}}' looks like an API response type. Keep API response schemas in apps/api, not packages/core.",
		},
	},
	create(context) {
		if (!isCoreFile(getFilename(context))) {
			return {};
		}

		return {
			VariableDeclarator(node) {
				if (node.id?.type === "Identifier") {
					reportIfResponse(context, node.id, node.id.name);
				}
			},
			TSTypeAliasDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfResponse(context, node.id, node.id.name);
				}
			},
			TSInterfaceDeclaration(node) {
				if (node.id?.type === "Identifier") {
					reportIfResponse(context, node.id, node.id.name);
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-api-response-schema-in-core",
	},
	rules: {
		"no-api-response-schema-in-core": rule,
	},
};

export default plugin;
