export const secrets = {
	planetScaleDatabaseId: new sst.Secret("PlanetScaleDatabaseId"),
	planetScaleOrganization: new sst.Secret("PlanetScaleOrganization"),
	postHogHost: new sst.Secret("PostHogHost"),
	postHogProjectApiKey: new sst.Secret("PostHogProjectApiKey"),
	betterAuthSecret: new sst.Secret("BetterAuthSecret"),
	gitHubClientId: new sst.Secret("GitHubClientId"),
	gitHubClientSecret: new sst.Secret("GitHubClientSecret"),
	polarAccessToken: new sst.Secret("PolarAccessToken"),
	polarSuccessUrl: new sst.Secret("PolarSuccessUrl"),
	polarWebhookSecret: new sst.Secret("PolarWebhookSecret"),
	resendApiKey: new sst.Secret("ResendApiKey"),
	renderOwnerId: new sst.Secret("RenderOwnerId"),
	zeroAdminPassword: new sst.Secret("ZeroAdminPassword"),
	zeroDatabasePassword: new sst.Secret("ZeroDatabasePassword"),
	zeroDatabaseUsername: new sst.Secret("ZeroDatabaseUsername"),
};

export const apiSecrets = [
	secrets.postHogHost,
	secrets.postHogProjectApiKey,
	secrets.betterAuthSecret,
	secrets.gitHubClientId,
	secrets.gitHubClientSecret,
	secrets.polarAccessToken,
	secrets.polarSuccessUrl,
	secrets.polarWebhookSecret,
	secrets.resendApiKey,
];
