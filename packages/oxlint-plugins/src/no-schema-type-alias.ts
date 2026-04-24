function isSameSchemaTypeAlias(node) {
	const idName = node.id?.name;
	const typeAnnotation = node.typeAnnotation;

	return (
		typeof idName === "string" &&
		typeAnnotation?.type === "TSTypeQuery" &&
		typeAnnotation.exprName?.type === "TSQualifiedName" &&
		typeAnnotation.exprName.left?.type === "Identifier" &&
		typeAnnotation.exprName.left.name === idName &&
		typeAnnotation.exprName.right?.type === "Identifier" &&
		typeAnnotation.exprName.right.name === "Type"
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow aliases like `export type User = typeof User.Type`.",
		},
		messages: {
			banned:
				"Do not alias schema types as '{{name}}'. Use `typeof {{name}}.Type` where it is needed.",
		},
	},
	create(context) {
		return {
			TSTypeAliasDeclaration(node) {
				if (!isSameSchemaTypeAlias(node)) {
					return;
				}

				context.report({
					node,
					messageId: "banned",
					data: { name: node.id.name },
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-schema-type-alias",
	},
	rules: {
		"no-schema-type-alias": rule,
	},
};

export default plugin;
