import { isRuntimeNameDeclared } from "./scope.ts";

function isIdentifier(node, name) {
	return node?.type === "Identifier" && node.name === name;
}

function isImportMetaEnv(node) {
	return (
		node?.type === "MemberExpression" &&
		node.object?.type === "MemberExpression" &&
		node.object.object?.type === "MetaProperty" &&
		node.object.object.meta?.type === "Identifier" &&
		node.object.object.meta.name === "import" &&
		node.object.object.property?.type === "Identifier" &&
		node.object.object.property.name === "meta" &&
		node.object.property?.type === "Identifier" &&
		node.object.property.name === "env"
	);
}

function isViteApiUrl(node) {
	return (
		node?.type === "MemberExpression" &&
		isImportMetaEnv(node.object) &&
		node.property?.type === "Identifier" &&
		node.property.name === "VITE_API_URL"
	);
}

function isOurApiUrl(node) {
	if (!node) {
		return false;
	}

	if (node.type === "TemplateLiteral") {
		return node.expressions.some(isOurApiUrl);
	}

	if (node.type === "BinaryExpression" && node.operator === "+") {
		return isOurApiUrl(node.left) || isOurApiUrl(node.right);
	}

	if (node.type === "NewExpression" && isIdentifier(node.callee, "URL")) {
		return node.arguments.some(isOurApiUrl);
	}

	return isViteApiUrl(node);
}

function isDirectFetch(node) {
	if (isIdentifier(node, "fetch") && !isRuntimeNameDeclared(node, "fetch")) {
		return true;
	}

	return (
		node?.type === "MemberExpression" &&
		node.property?.type === "Identifier" &&
		node.property.name === "fetch" &&
		((isIdentifier(node.object, "window") && !isRuntimeNameDeclared(node.object, "window")) ||
			(isIdentifier(node.object, "globalThis") &&
				!isRuntimeNameDeclared(node.object, "globalThis")))
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow direct fetch calls to the Leuchtturm API. Use @leuchtturm/web/clients/api instead.",
		},
		messages: {
			banned:
				"Do not call fetch() directly against the Leuchtturm API. Use @leuchtturm/web/clients/api instead.",
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				if (!isDirectFetch(node.callee)) {
					return;
				}

				const [url] = node.arguments;
				if (!isOurApiUrl(url)) {
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
		name: "no-direct-fetch",
	},
	rules: {
		"no-direct-fetch": rule,
	},
};

export default plugin;
