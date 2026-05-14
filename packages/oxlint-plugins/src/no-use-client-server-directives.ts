const BANNED_DIRECTIVES = new Set(["use client", "use server"]);

function getDirectiveValue(node) {
	if (typeof node?.directive === "string") {
		return node.directive;
	}

	if (node?.expression?.type === "Literal" && typeof node.expression.value === "string") {
		return node.expression.value;
	}

	return undefined;
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: 'Disallow "use client" and "use server" directives.',
		},
		messages: {
			banned: 'Do not use "{{directive}}" directives.',
		},
	},
	create(context) {
		return {
			ExpressionStatement(node) {
				const directive = getDirectiveValue(node);
				if (!BANNED_DIRECTIVES.has(directive)) {
					return;
				}

				context.report({
					node,
					messageId: "banned",
					data: { directive },
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-use-client-server-directives",
	},
	rules: {
		"no-use-client-server-directives": rule,
	},
};

export default plugin;
