import { defineConfig } from "vitest/config";

export default defineConfig({
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
