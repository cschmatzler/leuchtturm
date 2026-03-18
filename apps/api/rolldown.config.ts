import { defineConfig } from "rolldown";

export default defineConfig({
	input: ["src/server.ts"],
	output: {
		dir: "dist",
		format: "esm",
		sourcemap: true,
	},
	platform: "node",
	external: [/^pg($|\/)/],
});
