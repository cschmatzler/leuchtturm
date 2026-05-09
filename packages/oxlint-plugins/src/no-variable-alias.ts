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

function isSingleLine(node) {
	return node?.loc?.start?.line !== undefined && node.loc.start.line === node.loc.end?.line;
}

function isInlineConfigAlias(node) {
	node = unwrapTypeExpression(node);

	return (
		isSingleLine(node) && (node?.type === "TemplateLiteral" || node?.type === "ArrayExpression")
	);
}

function isRedundantVariableAlias(left, right) {
	const leftName = identifierName(left);
	const rightName = identifierName(right);
	right = unwrapTypeExpression(right);

	if (leftName && rightName) {
		return leftName === rightName;
	}

	const envName = propertyName(right);
	return (
		!!leftName &&
		typeof envName === "string" &&
		isImportMetaEnv(right) &&
		normalizeEnvName(leftName) === normalizeEnvName(envName)
	);
}

function isDeclarationIdentifier(node) {
	return node.parent?.type === "VariableDeclarator" && node.parent.id === node;
}

function nearestScope(node) {
	let current = node?.parent;

	while (current) {
		if (
			current.type === "Program" ||
			current.type === "FunctionDeclaration" ||
			current.type === "FunctionExpression" ||
			current.type === "ArrowFunctionExpression"
		) {
			return current;
		}

		current = current.parent;
	}
}

function isInsideObjectPropertyValue(node) {
	let current = node;

	while (current?.parent) {
		const parent = current.parent;

		if (parent.type === "Property") {
			return parent.value === current || parent.shorthand === true;
		}

		if (
			parent.type === "VariableDeclarator" ||
			parent.type === "FunctionDeclaration" ||
			parent.type === "FunctionExpression" ||
			parent.type === "ArrowFunctionExpression"
		) {
			return false;
		}

		current = parent;
	}

	return false;
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
		const inlineConfigAliases = new Map();
		const reportedInlineConfigAliases = new Set();

		return {
			VariableDeclarator(node) {
				const name = identifierName(node.id);
				if (name && !node.id?.typeAnnotation && isInlineConfigAlias(node.init)) {
					inlineConfigAliases.set(name, { node, scope: nearestScope(node) });
				}

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
			Identifier(node) {
				const declaration = inlineConfigAliases.get(node.name);
				if (
					!declaration ||
					reportedInlineConfigAliases.has(node.name) ||
					declaration.scope !== nearestScope(node) ||
					isDeclarationIdentifier(node) ||
					!isInsideObjectPropertyValue(node)
				) {
					return;
				}

				reportedInlineConfigAliases.add(node.name);
				context.report({
					node: declaration.node,
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
