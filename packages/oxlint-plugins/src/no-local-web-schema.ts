function getFilename(context) {
	return context.filename ?? context.getFilename?.() ?? "";
}

function isWebPageFile(filename) {
	return filename.includes("/apps/web/src/pages/") || filename.startsWith("apps/web/src/pages/");
}

function isMemberCallExpression(node, propertyName) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.property?.type === "Identifier" &&
		node.callee.property.name === propertyName
	);
}

function isSchemaStructCall(node) {
	return (
		isMemberCallExpression(node, "Struct") &&
		node.callee.object?.type === "Identifier" &&
		node.callee.object.name === "Schema"
	);
}

function isSchemaProjectionCall(node) {
	return isMemberCallExpression(node, "mapFields");
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow local schema constants in apps/web pages.",
		},
		messages: {
			banned:
				"Do not define local schema '{{name}}' in apps/web pages. Use core schemas directly or inline the projection at the use site.",
		},
	},
	create(context) {
		if (!isWebPageFile(getFilename(context))) {
			return {};
		}

		return {
			VariableDeclarator(node) {
				if (node.id?.type !== "Identifier") {
					return;
				}

				if (!isSchemaStructCall(node.init) && !isSchemaProjectionCall(node.init)) {
					return;
				}

				context.report({
					node: node.id,
					messageId: "banned",
					data: { name: node.id.name },
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-local-web-schema",
	},
	rules: {
		"no-local-web-schema": rule,
	},
};

export default plugin;
