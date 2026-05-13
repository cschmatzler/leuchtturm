import { defineConfig } from "oxlint";

const localRules = [
	"consistent-component-hook-groups",
	"namespace-filename-match",
	"no-api-response-schema-in-core",
	"no-direct-fetch",
	"no-effect-try-helper",
	"no-generic-domain-error-class",
	"no-live-suffix",
	"no-local-effect-callback-wrapper",
	"no-local-web-schema",
	"no-namespace-imports",
	"no-non-exact-package-json-versions",
	"no-phosphor-top-level-import",
	"no-relative-imports",
	"no-row-suffix",
	"no-schema-type-alias",
	"no-use-params-strict-false",
	"no-variable-alias",
	"no-vi-mock",
] as const;

const rootLocalRules = localRules.filter(
	(rule) => rule !== "no-direct-fetch" && rule !== "no-namespace-imports",
);

export default defineConfig({
	plugins: ["eslint", "typescript", "unicorn", "react", "react-perf", "oxc", "import"],
	options: {
		typeAware: true,
		typeCheck: true,
	},
	jsPlugins: localRules.map((rule) => `./packages/oxlint-plugins/src/${rule}.ts`),
	ignorePatterns: [
		"**/node_modules/**",
		"**/dist/**",
		"**/*.gen.ts",
		"**/sst-env.d.ts",
		".opencode/**",
		".pi/**",
		"packages/oxlint-plugins/**",
	],
	rules: {
		...Object.fromEntries(rootLocalRules.map((rule) => [`${rule}/${rule}`, "error"] as const)),
		"@typescript-eslint/no-floating-promises": "off",
		"@typescript-eslint/unbound-method": "off",
		"eslint/no-unused-vars": "off",
		"react/exhaustive-deps": "error",
		"react/rules-of-hooks": "error",
	},
	overrides: [
		{
			files: ["apps/web/**/*.{ts,tsx}"],
			rules: {
				"no-direct-fetch/no-direct-fetch": "error",
			},
		},
		{
			files: ["apps/web/src/components/**/*.{ts,tsx}"],
			rules: {
				"no-namespace-imports/no-namespace-imports": "error",
			},
		},
	],
});
