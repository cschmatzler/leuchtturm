import { secrets } from "@leuchtturm/infra/secrets";

const database = planetscale.getDatabasePostgresOutput({
	id: secrets.planetScaleDatabaseId.value,
	organization: secrets.planetScaleOrganization.value,
});

const branch = planetscale.getPostgresBranchOutput({
	id: database.defaultBranch,
	organization: database.organization,
	database: database.name,
});

const hyperdriveRole = new planetscale.PostgresBranchRole("HyperdriveRole", {
	branch: branch.name,
	database: database.name,
	organization: database.organization,
	name: `${$app.name}-${$app.stage}-hyperdrive`,
	inheritedRoles: ["pg_read_all_data", "pg_write_all_data"],
});

export const hyperdrive = new cloudflare.HyperdriveConfig("ApiHyperdrive", {
	accountId: sst.cloudflare.DEFAULT_ACCOUNT_ID,
	name: `${$app.name}-${$app.stage}-api`,
	origin: {
		database: hyperdriveRole.databaseName,
		host: hyperdriveRole.accessHostUrl,
		password: hyperdriveRole.password,
		port: 5432,
		scheme: "postgres",
		user: hyperdriveRole.username,
	},
});

export const hyperdriveBinding = new sst.Linkable("HYPERDRIVE", {
	properties: {},
	include: [
		sst.cloudflare.binding({
			type: "hyperdriveBindings",
			properties: {
				id: hyperdrive.id,
			},
		}),
	],
});

export { branch, database, hyperdriveRole };
