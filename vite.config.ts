import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		$schema: "./node_modules/oxfmt/configuration_schema.json",
		ignorePatterns: ["**/*.gen.ts", "**/sst-env.d.ts"],
		useTabs: true,
		experimentalSortImports: {
			internalPattern: ["@leuchtturm/"],
			newlinesBetween: true,
			groups: [["external", "builtin"], ["internal"], ["parent", "sibling", "index"]],
		},
	},
	lint: {
		plugins: ["eslint", "typescript", "unicorn", "react", "react-perf", "oxc", "import"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		jsPlugins: [
			"./packages/oxlint-plugins/src/consistent-component-hook-groups.ts",
			"./packages/oxlint-plugins/src/no-api-response-schema-in-core.ts",
			"./packages/oxlint-plugins/src/no-direct-fetch.ts",
			"./packages/oxlint-plugins/src/no-effect-try-helper.ts",
			"./packages/oxlint-plugins/src/no-generic-domain-error-class.ts",
			"./packages/oxlint-plugins/src/no-http-status-in-core.ts",
			"./packages/oxlint-plugins/src/no-live-suffix.ts",
			"./packages/oxlint-plugins/src/no-local-effect-callback-wrapper.ts",
			"./packages/oxlint-plugins/src/no-local-web-schema.ts",
			"./packages/oxlint-plugins/src/no-non-exact-package-json-versions.ts",
			"./packages/oxlint-plugins/src/no-relative-imports.ts",
			"./packages/oxlint-plugins/src/no-row-suffix.ts",
			"./packages/oxlint-plugins/src/no-schema-type-alias.ts",
			"./packages/oxlint-plugins/src/no-use-params-strict-false.ts",
			"./packages/oxlint-plugins/src/no-vi-mock.ts",
		],
		ignorePatterns: [
			"**/node_modules/**",
			"**/dist/**",
			"**/*.gen.ts",
			"**/sst-env.d.ts",
			".opencode/**",
			"packages/oxlint-plugins/**",
		],
		rules: {
			"consistent-component-hook-groups/consistent-component-hook-groups": "error",
			"no-api-response-schema-in-core/no-api-response-schema-in-core": "error",
			"no-effect-try-helper/no-effect-try-helper": "error",
			"no-generic-domain-error-class/no-generic-domain-error-class": "error",
			"no-http-status-in-core/no-http-status-in-core": "error",
			"no-live-suffix/no-live-suffix": "error",
			"no-local-effect-callback-wrapper/no-local-effect-callback-wrapper": "error",
			"no-local-web-schema/no-local-web-schema": "error",
			"no-non-exact-package-json-versions/no-non-exact-package-json-versions": "error",
			"no-relative-imports/no-relative-imports": "error",
			"no-row-suffix/no-row-suffix": "error",
			"no-schema-type-alias/no-schema-type-alias": "error",
			"no-use-params-strict-false/no-use-params-strict-false": "error",
			"no-vi-mock/no-vi-mock": "error",
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
		],
	},
	test: {
		silent: "passed-only",
		projects: [
			{
				extends: true,
				test: {
					name: "web",
					root: "./apps/web",
					environment: "happy-dom",
					include: ["src/**/*.test.{ts,tsx}"],
					env: {
						VITE_API_URL: "http://localhost:3000",
					},
				},
			},
			{
				extends: true,
				test: {
					name: "core",
					root: "./packages/core",
					include: ["src/**/*.test.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "api",
					root: "./apps/api",
					include: ["src/**/*.test.ts"],
					env: {
						RESEND_API_KEY: "test-resend-key",
						AUTUMN_SECRET_KEY: "test-autumn-key",
						PORT: "3000",
						BASE_URL: "http://localhost:3000",
					},
				},
			},
		],
	},
});
