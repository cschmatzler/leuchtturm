function isUseParams(node) {
	return node?.type === "Identifier" && node.name === "useParams";
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
		return {
			CallExpression(node) {
				if (!isUseParams(node.callee)) {
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
