function getIdentifierName(node) {
	return node?.type === "Identifier" ? node.name : undefined;
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow namespace imports and namespace member access. Import used bindings directly instead.",
		},
		messages: {
			namespaceImport: "Do not use namespace imports. Import used bindings directly instead.",
			namespaceMember:
				"Do not use namespace member access. Import the referenced binding directly instead.",
		},
	},
	create(context) {
		const namespaceImportNames = new Set<string>();
		const isForbiddenNamespaceName = (name) => name === "React" || namespaceImportNames.has(name);

		return {
			ImportNamespaceSpecifier(node) {
				const localName = getIdentifierName(node.local);
				if (localName) {
					namespaceImportNames.add(localName);
				}

				context.report({
					node,
					messageId: "namespaceImport",
				});
			},
			MemberExpression(node) {
				if (!isForbiddenNamespaceName(getIdentifierName(node.object))) {
					return;
				}

				context.report({
					node,
					messageId: "namespaceMember",
				});
			},
			TSQualifiedName(node) {
				if (!isForbiddenNamespaceName(getIdentifierName(node.left))) {
					return;
				}

				context.report({
					node,
					messageId: "namespaceMember",
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-namespace-imports",
	},
	rules: {
		"no-namespace-imports": rule,
	},
};

export default plugin;
