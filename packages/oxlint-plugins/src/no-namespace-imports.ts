import { isLocalNameDeclared } from "./scope.ts";

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
		const reactImportNames = new Set<string>();
		const isForbiddenNamespaceName = (node) => {
			const name = getIdentifierName(node);
			return (
				!!name &&
				!isLocalNameDeclared(node, name) &&
				(namespaceImportNames.has(name) || reactImportNames.has(name))
			);
		};

		return {
			ImportDeclaration(node) {
				if (node.source?.value !== "react") {
					return;
				}

				for (const specifier of node.specifiers) {
					if (specifier.type === "ImportDefaultSpecifier") {
						reactImportNames.add(getIdentifierName(specifier.local));
					}
				}
			},
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
				if (!isForbiddenNamespaceName(node.object)) {
					return;
				}

				context.report({
					node,
					messageId: "namespaceMember",
				});
			},
			TSQualifiedName(node) {
				if (!isForbiddenNamespaceName(node.left)) {
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
