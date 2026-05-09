import { isLocalNameDeclared } from "./scope.ts";

function getIdentifierName(node) {
	return node?.type === "Identifier" ? node.name : undefined;
}

function isStrictFalseOption(node) {
	return (
		node?.type === "Property" &&
		node.key?.type === "Identifier" &&
		node.key.name === "strict" &&
		node.value?.type === "Literal" &&
		node.value.value === false
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow useParams({ strict: false }). Use a route-specific params hook instead.",
		},
		messages: {
			banned: "Do not use useParams({ strict: false }). Use a route-specific params hook instead.",
		},
	},
	create(context) {
		const useParamsNames = new Set();

		return {
			ImportDeclaration(node) {
				if (node.source?.value !== "@tanstack/react-router") {
					return;
				}

				for (const specifier of node.specifiers) {
					const localName = getIdentifierName(specifier.local);
					if (
						specifier.type === "ImportSpecifier" &&
						getIdentifierName(specifier.imported) === "useParams" &&
						localName
					) {
						useParamsNames.add(localName);
					}
				}
			},
			CallExpression(node) {
				if (
					node.callee?.type !== "Identifier" ||
					!useParamsNames.has(node.callee.name) ||
					isLocalNameDeclared(node.callee, node.callee.name)
				) {
					return;
				}

				const [options] = node.arguments;
				if (options?.type !== "ObjectExpression" || !options.properties.some(isStrictFalseOption)) {
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
		name: "no-use-params-strict-false",
	},
	rules: {
		"no-use-params-strict-false": rule,
	},
};

export default plugin;
