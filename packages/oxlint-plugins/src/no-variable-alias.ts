function unwrapTypeExpression(node) {
	while (
		node?.type === "TSAsExpression" ||
		node?.type === "TSTypeAssertion" ||
		node?.type === "TSNonNullExpression"
	) {
		node = node.expression;
	}

	return node;
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

function normalizeEnvName(name) {
	return name
		.replace(/^(VITE_|PUBLIC_|NEXT_PUBLIC_|REACT_APP_)/u, "")
		.replaceAll("_", "")
		.toLowerCase();
}

function identifierName(node) {
	node = unwrapTypeExpression(node);

	if (node?.type === "Identifier") {
		return node.name;
	}
}

function propertyName(node) {
	node = unwrapTypeExpression(node);

	if (node?.type !== "MemberExpression") {
		return;
	}

	if (node.property?.type === "Identifier") {
		return node.property.name;
	}

	if (node.property?.type === "Literal" && typeof node.property.value === "string") {
		return node.property.value;
	}
}

function isRedundantVariableAlias(left, right) {
	const leftName = identifierName(left);
	const rightName = identifierName(right);

	if (leftName && rightName) {
		return leftName === rightName;
	}

	const envName = propertyName(right);
	return (
		!!leftName &&
		isImportMetaEnv(unwrapTypeExpression(right)) &&
		normalizeEnvName(leftName) === normalizeEnvName(envName)
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow redundant variable aliases. Use the original expression directly where it is needed.",
		},
		messages: {
			banned:
				"Do not assign a value to a redundant local alias. Use the original expression directly where it is needed.",
		},
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				if (!isRedundantVariableAlias(node.id, node.init)) {
					return;
				}

				context.report({
					node,
					messageId: "banned",
				});
			},
			AssignmentExpression(node) {
				if (node.left?.type !== "Identifier" || !isRedundantVariableAlias(node.left, node.right)) {
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
		name: "no-variable-alias",
	},
	rules: {
		"no-variable-alias": rule,
	},
};

export default plugin;
