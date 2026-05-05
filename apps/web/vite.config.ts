import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
	envPrefix: ["VITE_", "PORTLESS_"],
	server: {
		allowedHosts: [".ts.net"],
		proxy: {
			"/api": {
				target: process.env.VITE_API_URL,
				changeOrigin: true,
				cookieDomainRewrite: "",
				xfwd: true,
				configure(proxy) {
					proxy.on("proxyReq", (proxyReq) => {
						proxyReq.setHeader("x-forwarded-proto", "https");
					});
				},
			},
		},
	},
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
	optimizeDeps: {
		include: ["@phosphor-icons/react"],
	},
});
