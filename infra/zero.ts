import { interpolate } from "@pulumi/pulumi";

import { appDomain, syncDomain, zone } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

export const zero = new render.services.WebService("ZeroService", {
	name: `${$app.name}-${$app.stage}-zero`,
	ownerId: secrets.renderOwnerId.value,
	type: "web_service",
	image: {
		imagePath: "rocicorp/zero:1.3.0",
		ownerId: secrets.renderOwnerId.value,
	},
	serviceDetails: {
		region: "frankfurt",
		plan: "starter",
		runtime: "image",
		numInstances: 1,
		healthCheckPath: "/keepalive",
		disk: {
			mountPath: "/var/data",
			name: `${$app.name}-${$app.stage}-zero-data`,
			sizeGB: 1,
		},
	},
	envVars: [
		{ key: "ZERO_ADMIN_PASSWORD", value: secrets.zeroAdminPassword.value },
		{ key: "ZERO_APP_ID", value: "leuchtturm" },
		{ key: "PORT", value: "4848" },
		{
			key: "ZERO_CHANGE_DB",
			value: interpolate`postgres://${secrets.zeroDatabaseUsername.value}:${secrets.zeroDatabasePassword.value}@eu-central-1.pg.psdb.cloud:5432/postgres?sslmode=verify-full`,
		},
		{
			key: "ZERO_CVR_DB",
			value: interpolate`postgres://${secrets.zeroDatabaseUsername.value}:${secrets.zeroDatabasePassword.value}@eu-central-1.pg.psdb.cloud:5432/postgres?sslmode=verify-full`,
		},
		{ key: "ZERO_MUTATE_FORWARD_COOKIES", value: "true" },
		{ key: "ZERO_MUTATE_URL", value: $interpolate`https://${appDomain}/api/mutate` },
		{ key: "ZERO_QUERY_FORWARD_COOKIES", value: "true" },
		{ key: "ZERO_QUERY_URL", value: $interpolate`https://${appDomain}/api/query` },
		{ key: "ZERO_REPLICA_FILE", value: "/var/data/zero.db" },
		{
			key: "ZERO_UPSTREAM_DB",
			value: interpolate`postgres://${secrets.zeroDatabaseUsername.value}:${secrets.zeroDatabasePassword.value}@eu-central-1.pg.psdb.cloud:5432/postgres?sslmode=verify-full`,
		},
	],
});

new render.services.CustomDomain("ZeroCustomDomain", {
	name: syncDomain,
	serviceId: zero.id,
});

new cloudflare.DnsRecord("ZeroCustomDomainRecord", {
	zoneId: zone.zoneId,
	name: syncDomain,
	type: "CNAME",
	content: zero.serviceDetails.apply((details) => {
		if (!details?.url) {
			throw new Error("Render did not return a URL for the Zero service.");
		}

		return new URL(details.url).hostname;
	}),
	proxied: false,
	ttl: 1,
});
