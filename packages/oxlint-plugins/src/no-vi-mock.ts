const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow vi.mock(), vi.stubGlobal(), and vi.spyOn().",
		},
		messages: {
			banned:
				"vi.{{method}}() is banned. Prefer real providers/state and tests-only rewrites. Do not patch globals or imports; delete the test if it cannot be expressed cleanly.",
		},
	},
	create(context) {
		const banned = new Set(["mock", "stubGlobal", "spyOn"]);
		return {
			CallExpression(node) {
				if (
					node.callee.type === "MemberExpression" &&
					node.callee.object.type === "Identifier" &&
					node.callee.object.name === "vi" &&
					node.callee.property.type === "Identifier" &&
					banned.has(node.callee.property.name)
				) {
					context.report({
						node,
						messageId: "banned",
						data: { method: node.callee.property.name },
					});
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-vi-mock",
	},
	rules: {
		"no-vi-mock": rule,
	},
};

export default plugin;
