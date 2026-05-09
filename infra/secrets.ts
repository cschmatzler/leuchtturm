export const secrets = {
	planetScaleDatabaseId: new sst.Secret("PlanetScaleDatabaseId"),
	planetScaleOrganization: new sst.Secret("PlanetScaleOrganization"),
	postHogHost: new sst.Secret("PostHogHost"),
	postHogProjectApiKey: new sst.Secret("PostHogProjectApiKey"),
	grafanaApiToken: new sst.Secret("GrafanaApiToken"),
	betterAuthSecret: new sst.Secret("BetterAuthSecret"),
	cloudflareAccessGitHubClientId: new sst.Secret("CloudflareAccessGitHubClientId"),
	cloudflareAccessGitHubClientSecret: new sst.Secret("CloudflareAccessGitHubClientSecret"),
	cloudflareAccountId: new sst.Secret("CloudflareAccountId"),
	googleClientId: new sst.Secret("GoogleClientId"),
	googleClientSecret: new sst.Secret("GoogleClientSecret"),
	polarAccessToken: new sst.Secret("PolarAccessToken"),
	polarSuccessUrl: new sst.Secret("PolarSuccessUrl"),
	polarWebhookSecret: new sst.Secret("PolarWebhookSecret"),
	renderOwnerId: new sst.Secret("RenderOwnerId"),
	zeroAdminPassword: new sst.Secret("ZeroAdminPassword"),
	zeroDatabasePassword: new sst.Secret("ZeroDatabasePassword"),
	zeroDatabaseUsername: new sst.Secret("ZeroDatabaseUsername"),
};

export const apiSecrets = [
	secrets.postHogHost,
	secrets.postHogProjectApiKey,

	secrets.betterAuthSecret,
	secrets.googleClientId,
	secrets.googleClientSecret,
	secrets.polarAccessToken,
	secrets.polarSuccessUrl,
	secrets.polarWebhookSecret,
];
