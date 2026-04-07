import { secret } from "@chevrotain/infra/secret";

const database = planetscale.getDatabasePostgresOutput({
	id: secret.planetScaleDatabaseId.value,
	organization: secret.planetScaleOrganization.value,
});

const branch = planetscale.getPostgresBranchOutput({
	id: database.defaultBranch,
	organization: database.organization,
	database: database.name,
});

const databaseRole = new planetscale.PostgresBranchRole("DatabaseRole", {
	branch: branch.name,
	database: database.name,
	organization: database.organization,
	name: `${$app.name}-${$app.stage}`,
	inheritedRoles: ["pg_read_all_data", "pg_write_all_data"],
});

export const hyperdrive = new cloudflare.HyperdriveConfig("ApiHyperdrive", {
	accountId: sst.cloudflare.DEFAULT_ACCOUNT_ID,
	name: `${$app.name}-${$app.stage}-api`,
	origin: {
		database: databaseRole.databaseName,
		host: databaseRole.accessHostUrl.apply(
			(connectionString) => new URL(connectionString).hostname,
		),
		password: databaseRole.password,
		port: databaseRole.accessHostUrl.apply((connectionString) => {
			const port = new URL(connectionString).port;
			return port ? Number(port) : 5432;
		}),
		scheme: "postgres",
		user: databaseRole.username,
	},
	caching: {
		disabled: true,
	},
});

export const zeroDatabaseUrl = databaseRole.accessHostUrl;
