import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	schema: "./src/**/*.sql.ts",
	out: "./migrations",
	schemaFilter: ["public"],
});
