const ROUTER_HOOKS = new Set([
	"useNavigate",
	"useMatchRoute",
	"useParams",
	"useSearch",
	"useRouter",
	"useRouterState",
]);

const QUERY_HOOKS = new Set([
	"useQuery",
	"useReactQuery",
	"useZeroQuery",
	"useSuspenseQuery",
	"useInfiniteQuery",
	"useSuspenseInfiniteQuery",
]);

const LOCAL_STATE_HOOKS = new Set(["useForm", "useReducer", "useState"]);

const GROUP_ORDER = {
	route: 0,
	query: 1,
	localState: 2,
};

function isCapitalized(name) {
	return typeof name === "string" && /^[A-Z]/.test(name);
}

function isIdentifier(node, name) {
	return node?.type === "Identifier" && (name === undefined || node.name === name);
}

function getHookName(callee) {
	if (callee?.type === "Identifier") {
		return callee.name;
	}

	if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
		return callee.property.name;
	}

	return undefined;
}

function isRouteHookCall(callee) {
	if (callee?.type === "Identifier") {
		return ROUTER_HOOKS.has(callee.name);
	}

	return (
		callee?.type === "MemberExpression" &&
		isIdentifier(callee.object, "Route") &&
		callee.property?.type === "Identifier" &&
		callee.property.name.startsWith("use")
	);
}

function getHookGroup(node) {
	if (node?.type !== "CallExpression") {
		return undefined;
	}

	const hookName = getHookName(node.callee);
	if (!hookName?.startsWith("use")) {
		return undefined;
	}

	if (isRouteHookCall(node.callee)) {
		return "route";
	}

	if (QUERY_HOOKS.has(hookName)) {
		return "query";
	}

	if (LOCAL_STATE_HOOKS.has(hookName)) {
		return "localState";
	}

	return undefined;
}

function getDeclarationHookGroup(statement) {
	if (statement?.type !== "VariableDeclaration") {
		return undefined;
	}

	for (const declaration of statement.declarations) {
		const group = getHookGroup(declaration.init);
		if (group) {
			return group;
		}
	}

	return undefined;
}

function getComponentName(node) {
	if (node.type === "FunctionDeclaration") {
		return node.id?.name;
	}

	if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
		return node.parent?.type === "VariableDeclarator" ? node.parent.id?.name : undefined;
	}

	return undefined;
}

function checkFunction(context, node) {
	if (!isCapitalized(getComponentName(node)) || node.body?.type !== "BlockStatement") {
		return;
	}

	let previousGroup;
	for (const statement of node.body.body) {
		const group = getDeclarationHookGroup(statement);
		if (!group) {
			continue;
		}

		if (previousGroup && GROUP_ORDER[group] < GROUP_ORDER[previousGroup]) {
			context.report({
				node: statement,
				messageId: "wrongOrder",
			});
			return;
		}

		previousGroup = group;
	}
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description:
				"Enforce consistent top-level component hook grouping: route hooks, query hooks, then local state hooks.",
		},
		messages: {
			wrongOrder:
				"Group top-level component hooks consistently: route hooks first, then query hooks, then local state hooks.",
		},
	},
	create(context) {
		return {
			FunctionDeclaration(node) {
				checkFunction(context, node);
			},
			FunctionExpression(node) {
				checkFunction(context, node);
			},
			ArrowFunctionExpression(node) {
				checkFunction(context, node);
			},
		};
	},
};

const plugin = {
	meta: {
		name: "consistent-component-hook-groups",
	},
	rules: {
		"consistent-component-hook-groups": rule,
	},
};

export default plugin;
