import { defineConfig } from "oxfmt";

export default defineConfig({
	$schema: "./node_modules/oxfmt/configuration_schema.json",
	ignorePatterns: ["**/*.gen.ts", "**/sst-env.d.ts"],
	useTabs: true,
	experimentalSortImports: {
		internalPattern: ["@leuchtturm/"],
		newlinesBetween: true,
		groups: [["external", "builtin"], ["internal"], ["parent", "sibling", "index"]],
	},
});
