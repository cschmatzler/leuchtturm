const bannedNames = new Set(["AuthError", "BillingError", "EmailError", "FeatureFlagsError"]);

function isTaggedErrorClassCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "CallExpression" &&
		node.callee.callee?.type === "MemberExpression" &&
		node.callee.callee.object?.type === "Identifier" &&
		node.callee.callee.object.name === "Schema" &&
		node.callee.callee.property?.type === "Identifier" &&
		node.callee.callee.property.name === "TaggedErrorClass"
	);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow constructible generic domain error classes.",
		},
		messages: {
			banned:
				"Do not model domain errors as a generic '{{name}}' class. Create specific error classes and export '{{name}}' as a Schema.Union instead.",
		},
	},
	create(context) {
		return {
			ClassDeclaration(node) {
				const name = node.id?.name;
				if (!bannedNames.has(name) || !isTaggedErrorClassCall(node.superClass)) {
					return;
				}

				context.report({
					node: node.id ?? node,
					messageId: "banned",
					data: { name },
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-generic-domain-error-class",
	},
	rules: {
		"no-generic-domain-error-class": rule,
	},
};

export default plugin;
