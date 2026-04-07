import { zeroDatabaseUrl } from "@chevrotain/infra/database";
import { zone } from "@chevrotain/infra/dns";
import { secret } from "@chevrotain/infra/secret";
import { apiUrl, zeroDomain, zeroUrl } from "@chevrotain/infra/stage";

const zeroLitestreamBucket = new sst.aws.Bucket("ZeroLitestreamBucket");
const zeroVpc = new sst.aws.Vpc("ZeroVpc");
const zeroCluster = new sst.aws.Cluster("ZeroCluster", { vpc: zeroVpc });

export const zero = new sst.aws.Service("Zero", {
	cluster: zeroCluster,
	cpu: "0.5 vCPU",
	link: [zeroLitestreamBucket],
	environment: {
		AWS_REGION: "eu-central-1",
		NODE_ENV: "production",
		ZERO_ADMIN_PASSWORD: secret.zeroAdminPassword.value,
		ZERO_APP_ID: "chevrotain",
		ZERO_CHANGE_DB: zeroDatabaseUrl,
		ZERO_CVR_DB: zeroDatabaseUrl,
		ZERO_LITESTREAM_BACKUP_URL: $interpolate`s3://${zeroLitestreamBucket.name}/replica-v1`,
		ZERO_MUTATE_FORWARD_COOKIES: "true",
		ZERO_MUTATE_URL: `${apiUrl}/mutate`,
		ZERO_QUERY_FORWARD_COOKIES: "true",
		ZERO_QUERY_URL: `${apiUrl}/query`,
		ZERO_REPLICA_FILE: "/tmp/zero.db",
		ZERO_UPSTREAM_DB: zeroDatabaseUrl,
	},
	health: {
		command: ["CMD-SHELL", "curl -f http://localhost:4848/keepalive || exit 1"],
		interval: "30 seconds",
		startPeriod: "30 seconds",
		timeout: "5 seconds",
	},
	image: "rocicorp/zero:1.1.1",
	loadBalancer: {
		domain: {
			dns: sst.cloudflare.dns({
				proxy: true,
				zone: zone.zoneId,
			}),
			name: zeroDomain,
		},
		health: {
			"4848/http": {
				healthyThreshold: 2,
				interval: "10 seconds",
				path: "/keepalive",
				successCodes: "200-299",
				timeout: "5 seconds",
				unhealthyThreshold: 3,
			},
		},
		rules: [
			{ listen: "80/http", redirect: "443/https" },
			{ forward: "4848/http", listen: "443/https" },
		],
	},
	logging: {
		retention: "1 month",
	},
	memory: "1 GB",
	scaling: {
		max: 1,
		min: 1,
	},
});

export { zeroUrl };
