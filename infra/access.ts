import { apiDomain, appDomain } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

if ($dev) {
	const githubIdentityProvider = new cloudflare.ZeroTrustAccessIdentityProvider(
		"DevGitHubIdentityProvider",
		{
			accountId: secrets.cloudflareAccountId.value,
			name: `${$app.name}-${$app.stage}-github`,
			type: "github",
			config: {
				clientId: secrets.cloudflareAccessGitHubClientId.value,
				clientSecret: secrets.cloudflareAccessGitHubClientSecret.value,
			},
		},
	);
	const githubOrganizationPolicy = new cloudflare.ZeroTrustAccessPolicy(
		"DevGitHubOrganizationPolicy",
		{
			accountId: secrets.cloudflareAccountId.value,
			name: `${$app.name}-${$app.stage}-leuchtturm-dev-github`,
			decision: "allow",
			includes: [
				{
					githubOrganization: {
						identityProviderId: githubIdentityProvider.id,
						name: "leuchtturm-dev",
					},
				},
			],
			sessionDuration: "24h",
		},
	);

	new cloudflare.ZeroTrustAccessApplication("DevAccessApplication", {
		accountId: secrets.cloudflareAccountId.value,
		name: `${$app.name}-${$app.stage}-dev`,
		type: "self_hosted",
		domain: appDomain,
		allowedIdps: [githubIdentityProvider.id],
		autoRedirectToIdentity: true,
		destinations: [
			{ type: "public", uri: appDomain },
			{ type: "public", uri: apiDomain },
		],
		corsHeaders: {
			allowCredentials: true,
			allowedOrigins: [$interpolate`https://${appDomain}`],
			allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowAllHeaders: true,
			maxAge: 86_400,
		},
		httpOnlyCookieAttribute: true,
		sameSiteCookieAttribute: "none",
		sessionDuration: "24h",
		policies: [{ id: githubOrganizationPolicy.id }],
	});
}
