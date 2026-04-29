function getFilename(context) {
	return context.filename ?? context.getFilename?.() ?? "";
}

function isCoreFile(filename) {
	return filename.includes("/packages/core/") || filename.startsWith("packages/core/");
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
				if (node.key?.type !== "Identifier" || node.key.name !== "httpApiStatus") {
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
