function getFilename(context) {
	return context.filename ?? context.getFilename?.() ?? "";
}

function isCoreFile(filename) {
	return filename.includes("/packages/core/") || filename.startsWith("packages/core/");
}

function getPropertyName(node) {
	if (node?.type === "Identifier") {
		return node.name;
	}

	return node?.type === "Literal" && typeof node.value === "string" ? node.value : undefined;
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow HTTP status annotations in packages/core.",
		},
		messages: {
			banned:
				"Keep HTTP status translation in apps/api, not packages/core. Annotate this error in apps/api/src/errors.ts instead.",
		},
	},
	create(context) {
		if (!isCoreFile(getFilename(context))) {
			return {};
		}

		return {
			Property(node) {
				if (getPropertyName(node.key) !== "httpApiStatus") {
					return;
				}

				context.report({
					node: node.key,
					messageId: "banned",
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-http-status-in-core",
	},
	rules: {
		"no-http-status-in-core": rule,
	},
};

export default plugin;
