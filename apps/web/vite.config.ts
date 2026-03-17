import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [
		devtools(),
		tanstackRouter({ autoCodeSplitting: true, routesDirectory: "src/pages" }),
		tailwindcss(),
		react(),
	],
	build: {
		sourcemap: true,
		chunkSizeWarningLimit: 650,
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
	define: {
		__BUILD_HASH__: JSON.stringify(Date.now().toString(36)),
	},
	optimizeDeps: {
		include: ["lucide-react"],
	},
});
