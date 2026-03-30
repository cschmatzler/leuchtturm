import { defineConfig } from "drizzle-kit";
import { Config, ConfigProvider, Effect } from "effect";

const databaseUrl = Effect.runSync(Config.string("DATABASE_URL").parse(ConfigProvider.fromEnv()));

export default defineConfig({
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
	schema: "./src/**/*.sql.ts",
	out: "./migrations",
	schemaFilter: ["public"],
});
