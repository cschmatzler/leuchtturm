import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		devtools(),
		tanstackRouter({ autoCodeSplitting: true, routesDirectory: "src/pages" }),
		tailwindcss(),
		react(),
	],
	server: {
		allowedHosts: [".leuchtturm.dev", ".ts.net"],
	},
	resolve: {
		dedupe: ["react", "react/jsx-runtime"],
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (id.includes("@rocicorp")) return "vendor-zero";
						if (id.includes("@base-ui") || id.includes("@floating-ui")) return "vendor-ui";
						if (id.includes("effect") || id.includes("@effect")) return "vendor-schema";
					}
				},
			},
		},
	},
});
