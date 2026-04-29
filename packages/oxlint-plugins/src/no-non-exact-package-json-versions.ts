import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const dependencySections = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;

const ignoredDirectories = new Set([".devenv", ".git", ".jj", ".sst", "dist", "node_modules"]);

let scanned = false;
let violations: Array<string> = [];

function scanPackageJsonFiles(directory: string, root: string) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!ignoredDirectories.has(entry.name)) {
				scanPackageJsonFiles(join(directory, entry.name), root);
			}

			continue;
		}

		if (entry.name !== "package.json") {
			continue;
		}

		const packageJsonPath = join(directory, entry.name);
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
		for (const section of dependencySections) {
			const dependencies = packageJson[section];
			if (!dependencies || typeof dependencies !== "object") {
				continue;
			}

			for (const [dependencyName, version] of Object.entries(dependencies)) {
				if (typeof version === "string" && version.startsWith("^")) {
					violations.push(
						`${relative(root, packageJsonPath)} ${section}.${dependencyName} uses ${version}`,
					);
				}
			}
		}
	}
}

function getViolations() {
	if (!scanned) {
		scanned = true;
		const root = process.cwd();
		if (existsSync(join(root, "package.json"))) {
			scanPackageJsonFiles(root, root);
		}
	}

	return violations;
}

const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow caret dependency versions in package.json files.",
		},
	},
	create(context) {
		return {
			Program(node) {
				for (const violation of getViolations()) {
					context.report({
						node,
						message: `Use an exact package version instead of a caret range: ${violation}`,
					});
				}
			},
		};
	},
};

const plugin = {
	meta: {
		name: "no-non-exact-package-json-versions",
	},
	rules: {
		"no-non-exact-package-json-versions": rule,
	},
};

export default plugin;
