import { secrets } from "@leuchtturm/infra/secrets";

const database = planetscale.getDatabasePostgresOutput({
	id: secrets.planetScaleDatabaseId.value,
	organization: secrets.planetScaleOrganization.value,
});

const branch =
	$app.stage === "prod"
		? planetscale.getPostgresBranchOutput({
				id: "main",
				organization: database.organization,
				database: database.name,
			})
		: new planetscale.PostgresBranch("DatabaseBranch", {
				name: $app.stage,
				parentBranch: "main",
				database: database.name,
				organization: database.organization,
			});

const hyperdriveRole = new planetscale.PostgresBranchRole("HyperdriveRole", {
	branch: branch.name,
	database: database.name,
	organization: database.organization,
	name: $app.stage,
	inheritedRoles: ["pg_read_all_data", "pg_write_all_data"],
});

export const hyperdrive = new sst.cloudflare.Hyperdrive("Database", {
	origin: {
		scheme: "postgres",
		port: 5432,
		host: hyperdriveRole.accessHostUrl,
		user: hyperdriveRole.username,
		database: hyperdriveRole.databaseName,
		password: hyperdriveRole.password,
	},
});
