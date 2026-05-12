function getFilename(context) {
	return context.filename ?? context.getFilename?.() ?? "";
}

function toKebabCase(name) {
	return name
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

function getBasename(filename) {
	return (
		filename
			.replace(/\\/g, "/")
			.split("/")
			.at(-1)
			?.replace(/\.[^.]+$/, "") ?? ""
	);
}

function getIndexName(filename) {
	const parts = filename.replace(/\\/g, "/").split("/");
	const srcIndex = parts.lastIndexOf("src");

	if (srcIndex < 2 || parts.at(-1) !== "index.ts") {
		return undefined;
	}

	const scope = parts[srcIndex - 2];
	if (scope !== "apps" && scope !== "packages") {
		return undefined;
	}

	return parts[srcIndex - 1];
}

function getParentName(filename) {
	return filename.replace(/\\/g, "/").split("/").at(-2);
}

function getExpectedFilename(filename, namespaceName) {
	const basename = getBasename(filename);
	const namespaceFilename = toKebabCase(namespaceName);
	const parentName = getParentName(filename);

	if (basename === "index" && getIndexName(filename) === namespaceFilename) {
		return "index";
	}

	if (basename === "index" && parentName && `${parentName}-handler` === namespaceFilename) {
		return "index";
	}

	if (parentName && `${parentName}-${basename}` === namespaceFilename) {
		return basename;
	}

	return namespaceFilename;
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Require namespace files to match the namespace name.",
		},
		messages: {
			mismatch:
				"Namespace '{{namespaceName}}' should be declared in '{{expectedFilename}}.ts', not '{{actualFilename}}.ts'.",
		},
	},
	create(context) {
		const filename = getFilename(context);
		const actualFilename = getBasename(filename);

		if (filename.endsWith(".d.ts")) {
			return {};
		}

		return {
			TSModuleDeclaration(node) {
				if (node.id?.type !== "Identifier") {
					return;
				}

				const expectedFilename = getExpectedFilename(filename, node.id.name);
				if (expectedFilename === undefined || actualFilename === expectedFilename) {
					return;
				}

				context.report({
					node: node.id,
					messageId: "mismatch",
					data: {
						actualFilename,
						expectedFilename,
						namespaceName: node.id.name,
					},
				});
			},
		};
	},
};

const plugin = {
	meta: {
		name: "namespace-filename-match",
	},
	rules: {
		"namespace-filename-match": rule,
	},
};

export default plugin;
