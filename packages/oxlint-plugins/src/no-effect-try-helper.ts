function isEffectTryPromiseCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.object?.type === "Identifier" &&
		node.callee.object.name === "Effect" &&
		node.callee.property?.type === "Identifier" &&
		node.callee.property.name === "tryPromise"
	);
}

function containsEffectTryPromise(node, seen = new WeakSet()) {
	if (!node || typeof node !== "object") {
		return false;
	}

	if (seen.has(node)) {
		return false;
	}
	seen.add(node);

	if (isEffectTryPromiseCall(node)) {
		return true;
	}

	for (const [key, value] of Object.entries(node)) {
		if (key === "parent") {
			continue;
		}
		if (Array.isArray(value)) {
			if (value.some((item) => containsEffectTryPromise(item, seen))) {
				return true;
			}
		} else if (value && typeof value === "object" && containsEffectTryPromise(value, seen)) {
			return true;
		}
	}

	return false;
}

function startsWithTry(name) {
	return typeof name === "string" && /^try[A-Z_]/.test(name);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow local `try*` helpers that wrap Effect.tryPromise.",
		},
		messages: {
			banned:
				"Do not hide Effect.tryPromise behind '{{name}}'. Inline it at the call site with the specific error.",
		},
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				const name = node.id?.type === "Identifier" ? node.id.name : undefined;
				if (!startsWithTry(name) || !containsEffectTryPromise(node.init)) {
					return;
				}

				context.report({
					node: node.id,
					messageId: "banned",
					data: { name },
				});
			},
			FunctionDeclaration(node) {
				const name = node.id?.name;
				if (!startsWithTry(name) || !containsEffectTryPromise(node.body)) {
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
		name: "no-effect-try-helper",
	},
	rules: {
		"no-effect-try-helper": rule,
	},
};

export default plugin;
