import { apiDomain, appDomain } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

if ($dev) {
	const githubProvider = new cloudflare.ZeroTrustAccessIdentityProvider("GitHubProvider", {
		accountId: secrets.cloudflareAccountId.value,
		name: `${$app.name}-${$app.stage}-github`,
		type: "github",
		config: {
			clientId: secrets.cloudflareAccessGitHubClientId.value,
			clientSecret: secrets.cloudflareAccessGitHubClientSecret.value,
		},
	});

	const policy = new cloudflare.ZeroTrustAccessPolicy("AccessPolicy", {
		accountId: secrets.cloudflareAccountId.value,
		name: `${$app.name}-${$app.stage}-leuchtturm-dev-github`,
		decision: "allow",
		includes: [
			{
				githubOrganization: {
					identityProviderId: githubProvider.id,
					name: "leuchtturm-dev",
				},
			},
		],
		sessionDuration: "24h",
	});

	const zeroPolicy = new cloudflare.ZeroTrustAccessPolicy("ZeroAccessPolicy", {
		accountId: secrets.cloudflareAccountId.value,
		name: `${$app.name}-${$app.stage}-zero-render`,
		decision: "bypass",
		includes: [{ ip: { ip: "74.220.51.0/24" } }, { ip: { ip: "74.220.59.0/24" } }],
	});

	new cloudflare.ZeroTrustAccessApplication("Access", {
		accountId: secrets.cloudflareAccountId.value,
		name: `${$app.name}-${$app.stage}`,
		type: "self_hosted",
		domain: appDomain,
		allowedIdps: [githubProvider.id],
		policies: [{ id: zeroPolicy.id }, { id: policy.id }],
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
	});
}
