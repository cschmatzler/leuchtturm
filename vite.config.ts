import { defineConfig } from "vite-plus";

export default defineConfig({
	fmt: {
		$schema: "./node_modules/oxfmt/configuration_schema.json",
		useTabs: true,
		experimentalSortImports: {
			internalPattern: ["@chevrotain/"],
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
		jsPlugins: ["./packages/oxlint-plugins/src/no-relative-imports.ts", "@effect/eslint-plugin"],
		ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/*.gen.ts"],
		rules: {
			"no-relative-imports/no-relative-imports": "error",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/unbound-method": "off",
			"eslint/no-unused-vars": "off",
			"react/exhaustive-deps": "error",
			"react/rules-of-hooks": "error",
		},
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "web",
					root: "./apps/web",
					environment: "happy-dom",
					include: ["src/**/*.test.{ts,tsx}"],
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
