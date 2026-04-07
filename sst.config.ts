// @ts-nocheck

const APP_NAME = "chevrotain";
const APP_DOMAIN = "chevrotain.schmatzler.com";
const API_DOMAIN = `api.${APP_DOMAIN}`;
const SYNC_DOMAIN = `sync.${APP_DOMAIN}`;
const ZERO_IMAGE = "rocicorp/zero:1.0.0";
const ZERO_VIEW_SYNCER_PORT = 4848;
const ZERO_REPLICATION_MANAGER_PORT = 4849;
const API_URL = `https://${API_DOMAIN}`;
const BASE_URL = `https://${APP_DOMAIN}`;
const SYNC_URL = `https://${SYNC_DOMAIN}`;

export default $config({
	app(input) {
		return {
			name: APP_NAME,
			home: "aws",
			protect: input.stage === "production",
			removal: input.stage === "production" ? "retain" : "remove",
		};
	},
	async run() {
		const apiSecrets = {
			betterAuthSecret: new sst.Secret("BetterAuthSecret"),
			databaseUrl: new sst.Secret("DatabaseUrl"),
			githubClientId: new sst.Secret("GitHubClientId"),
			githubClientSecret: new sst.Secret("GitHubClientSecret"),
			gmailOauthClientId: new sst.Secret("GmailOauthClientId"),
			gmailOauthClientSecret: new sst.Secret("GmailOauthClientSecret"),
			gmailPubSubTopic: new sst.Secret("GmailPubSubTopic"),
			mailKek: new sst.Secret("MailKek"),
			polarAccessToken: new sst.Secret("PolarAccessToken"),
			polarWebhookSecret: new sst.Secret("PolarWebhookSecret"),
			resendApiKey: new sst.Secret("ResendApiKey"),
		};

		const zeroSecrets = {
			adminPassword: new sst.Secret("ZeroAdminPassword"),
			appPublications: new sst.Secret("ZeroAppPublications"),
			changeDbUrl: new sst.Secret("ZeroChangeDatabaseUrl"),
			cvrDbUrl: new sst.Secret("ZeroCvrDatabaseUrl"),
			upstreamDbUrl: new sst.Secret("ZeroUpstreamDatabaseUrl"),
		};

		const litestreamBucket = new sst.aws.Bucket("ZeroReplicaBackups");
		const web = new sst.aws.StaticSite("Web", {
			path: "apps/web",
			build: {
				command: "pnpm run build",
				output: "dist",
			},
			domain: APP_DOMAIN,
			environment: {
				VITE_API_URL: API_URL,
				VITE_BASE_URL: BASE_URL,
				VITE_SYNC_URL: SYNC_URL,
			},
		});

		const apiFunction = new sst.aws.Function("ApiFunction", {
			handler: "apps/api/src/index.handler",
			runtime: "nodejs22.x",
			memory: "1024 MB",
			timeout: "30 seconds",
			environment: {
				AUTH_BASE_URL: API_URL,
				BASE_URL,
				BETTER_AUTH_SECRET: apiSecrets.betterAuthSecret.value,
				DATABASE_URL: apiSecrets.databaseUrl.value,
				GITHUB_CLIENT_ID: apiSecrets.githubClientId.value,
				GITHUB_CLIENT_SECRET: apiSecrets.githubClientSecret.value,
				GMAIL_OAUTH_CLIENT_ID: apiSecrets.gmailOauthClientId.value,
				GMAIL_OAUTH_CLIENT_SECRET: apiSecrets.gmailOauthClientSecret.value,
				GMAIL_OAUTH_REDIRECT_URI: `${BASE_URL}/mail/callback`,
				GMAIL_PUBSUB_TOPIC: apiSecrets.gmailPubSubTopic.value,
				MAIL_KEK: apiSecrets.mailKek.value,
				NODE_ENV: "production",
				POLAR_ACCESS_TOKEN: apiSecrets.polarAccessToken.value,
				POLAR_SERVER: "production",
				POLAR_SUCCESS_URL: `${BASE_URL}/settings/billing`,
				POLAR_WEBHOOK_SECRET: apiSecrets.polarWebhookSecret.value,
				RESEND_API_KEY: apiSecrets.resendApiKey.value,
			},
		});

		const api = new sst.aws.ApiGatewayV2("Api", {
			cors: {
				allowCredentials: true,
				allowHeaders: ["*"],
				allowMethods: ["*"],
				allowOrigins: [BASE_URL],
				exposeHeaders: ["Content-Length", "X-Request-Id"],
				maxAge: "10 minutes",
			},
			domain: API_DOMAIN,
		});
		api.route("$default", apiFunction.arn);

		const vpc = new sst.aws.Vpc("ZeroVpc");
		const cluster = new sst.aws.Cluster("ZeroCluster", { vpc });

		const replicationManager = new sst.aws.Service("ZeroReplicationManager", {
			cluster,
			architecture: "arm64",
			cpu: "0.5 vCPU",
			memory: "1 GB",
			image: ZERO_IMAGE,
			link: [litestreamBucket],
			wait: true,
			environment: {
				LOG_LEVEL: "info",
				ZERO_ADMIN_PASSWORD: zeroSecrets.adminPassword.value,
				ZERO_APP_ID: APP_NAME,
				ZERO_APP_PUBLICATIONS: zeroSecrets.appPublications.value,
				ZERO_CHANGE_DB: zeroSecrets.changeDbUrl.value,
				ZERO_CVR_DB: zeroSecrets.cvrDbUrl.value,
				ZERO_INITIAL_SYNC_TABLE_COPY_WORKERS: "2",
				ZERO_LITESTREAM_BACKUP_URL: $interpolate`s3://${litestreamBucket.name}/replicas/zero.db`,
				ZERO_NUM_SYNC_WORKERS: "0",
				ZERO_PORT: `${ZERO_REPLICATION_MANAGER_PORT}`,
				ZERO_REPLICA_FILE: "/data/replica.db",
				ZERO_UPSTREAM_DB: zeroSecrets.upstreamDbUrl.value,
			},
			scaling: {
				min: 1,
				max: 1,
				cpuUtilization: false,
				memoryUtilization: false,
			},
			loadBalancer: {
				public: false,
				health: {
					[`${ZERO_REPLICATION_MANAGER_PORT}/http`]: {
						healthyThreshold: 2,
						interval: 5,
						path: "/keepalive",
						successCodes: ["200"],
						timeout: 3,
						unhealthyThreshold: 3,
					},
				},
				rules: [{ listen: "80/http", forward: `${ZERO_REPLICATION_MANAGER_PORT}/http` }],
			},
			transform: {
				service: {
					healthCheckGracePeriodSeconds: 600,
				},
				target: (args) => {
					args.healthCheck = {
						enabled: true,
						healthyThreshold: 2,
						interval: 5,
						path: "/keepalive",
						protocol: "HTTP",
						timeout: 3,
					};
				},
			},
		});

		const zero = new sst.aws.Service("ZeroViewSyncers", {
			cluster,
			architecture: "arm64",
			cpu: "1 vCPU",
			memory: "2 GB",
			image: ZERO_IMAGE,
			link: [litestreamBucket],
			environment: {
				LOG_LEVEL: "info",
				ZERO_ADMIN_PASSWORD: zeroSecrets.adminPassword.value,
				ZERO_APP_ID: APP_NAME,
				ZERO_CHANGE_MAX_CONNS: "2",
				ZERO_CHANGE_STREAMER_URI: replicationManager.url,
				ZERO_CVR_MAX_CONNS: "8",
				ZERO_MUTATE_FORWARD_COOKIES: "true",
				ZERO_MUTATE_URL: `${API_URL}/api/mutate`,
				ZERO_NUM_SYNC_WORKERS: "2",
				ZERO_PORT: `${ZERO_VIEW_SYNCER_PORT}`,
				ZERO_QUERY_FORWARD_COOKIES: "true",
				ZERO_QUERY_URL: `${API_URL}/api/query`,
				ZERO_REPLICA_FILE: "/data/replica.db",
			},
			loadBalancer: {
				domain: SYNC_DOMAIN,
				health: {
					[`${ZERO_VIEW_SYNCER_PORT}/http`]: {
						healthyThreshold: 2,
						interval: 30,
						path: "/keepalive",
						successCodes: ["200"],
						timeout: 10,
						unhealthyThreshold: 3,
					},
				},
				rules: [
					{ listen: "80/http", redirect: "443/https" },
					{ listen: "443/https", forward: `${ZERO_VIEW_SYNCER_PORT}/http` },
				],
			},
			scaling: {
				min: 2,
				max: 2,
				cpuUtilization: false,
				memoryUtilization: false,
			},
			transform: {
				service: {
					healthCheckGracePeriodSeconds: 600,
				},
				target: (args) => {
					args.healthCheck = {
						enabled: true,
						healthyThreshold: 2,
						interval: 5,
						path: "/keepalive",
						protocol: "HTTP",
						timeout: 3,
					};
					args.stickiness = {
						cookieDuration: 120,
						enabled: true,
						type: "lb_cookie",
					};
				},
			},
		});

		return {
			api: api.url,
			web: web.url,
			zero: zero.url,
		};
	},
});
