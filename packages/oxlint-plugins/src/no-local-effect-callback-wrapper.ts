function isEffectFnCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "CallExpression" &&
		node.callee.callee?.type === "MemberExpression" &&
		node.callee.callee.object?.type === "Identifier" &&
		node.callee.callee.object.name === "Effect" &&
		node.callee.callee.property?.type === "Identifier" &&
		node.callee.callee.property.name === "fn"
	);
}

function getEffectFnFunction(node) {
	if (!isEffectFnCall(node)) {
		return null;
	}

	const [fn] = node.arguments ?? [];
	return fn?.type === "FunctionExpression" || fn?.type === "ArrowFunctionExpression" ? fn : null;
}

function unwrapYieldExpression(statement) {
	if (statement?.type !== "ExpressionStatement") {
		return null;
	}

	const expression = statement.expression;
	return expression?.type === "YieldExpression" ? expression.argument : null;
}

function isBillingCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.object?.type === "Identifier" &&
		node.callee.object.name === "billing"
	);
}

function isLogInfoCall(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.object?.type === "Identifier" &&
		node.callee.object.name === "Effect" &&
		node.callee.property?.type === "Identifier" &&
		node.callee.property.name === "logInfo"
	);
}

function isEffectPipeStartingWithLogInfo(node) {
	return (
		node?.type === "CallExpression" &&
		node.callee?.type === "MemberExpression" &&
		node.callee.property?.type === "Identifier" &&
		node.callee.property.name === "pipe" &&
		isLogInfoCall(node.callee.object)
	);
}

function isTrivialCallbackWrapper(init) {
	const fn = getEffectFnFunction(init);
	const statements = fn?.body?.type === "BlockStatement" ? fn.body.body : [];
	if (statements.length !== 1) {
		return false;
	}

	const yielded = unwrapYieldExpression(statements[0]);
	return isBillingCall(yielded) || isEffectPipeStartingWithLogInfo(yielded);
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Disallow trivial local Effect.fn wrappers for callback glue; inline the effect at the callback site.",
		},
		messages: {
			banned:
				"'{{name}}' is trivial callback glue wrapped in Effect.fn. Inline it at the callback site.",
		},
	},
	create(context) {
		return {
			VariableDeclarator(node) {
				const name = node.id?.type === "Identifier" ? node.id.name : undefined;
				if (!name || !isTrivialCallbackWrapper(node.init)) {
					return;
				}

				context.report({
					node: node.id,
					messageId: "banned",
					data: { name },
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-local-effect-callback-wrapper",
	},
	rules: {
		"no-local-effect-callback-wrapper": rule,
	},
};

export default plugin;
