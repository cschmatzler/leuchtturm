import { apiDomain, appDomain, syncDomain, zone } from "@leuchtturm/infra/dns";
import { secrets } from "@leuchtturm/infra/secrets";

export const web = new sst.cloudflare.StaticSiteV2("Web", {
	path: "apps/web",
	domain: appDomain,
	trailingSlash: "drop",
	notFound: "single-page-application",
	environment: {
		VITE_API_URL: $interpolate`https://${apiDomain}`,
		VITE_POSTHOG_HOST: secrets.postHogHost.value,
		VITE_POSTHOG_KEY: secrets.postHogProjectApiKey.value,
		VITE_SYNC_URL: $interpolate`https://${syncDomain}`,
	},
	dev: {
		url: $interpolate`https://${appDomain}`,
		command: "vp dev --host 127.0.0.1 --strictPort",
	},
	build: {
		command: "pnpm run build",
		output: "dist",
	},
});

if ($dev) {
	const tunnel = new cloudflare.ZeroTrustTunnelCloudflared("WebTunnel", {
		accountId: secrets.cloudflareAccountId.value,
		configSrc: "cloudflare",
		name: `${$app.name}-${$app.stage}-web-dev`,
	});

	new cloudflare.DnsRecord("WebTunnelRecord", {
		zoneId: zone.zoneId,
		name: appDomain,
		type: "CNAME",
		content: $interpolate`${tunnel.id}.cfargotunnel.com`,
		proxied: true,
		ttl: 1,
	});

	new cloudflare.ZeroTrustTunnelCloudflaredConfig("WebTunnelConfig", {
		accountId: secrets.cloudflareAccountId.value,
		tunnelId: tunnel.id,
		config: {
			ingresses: [
				{
					hostname: appDomain,
					service: "http://localhost:5173",
				},
				{
					service: "http_status:404",
				},
			],
		},
	});

	new sst.x.DevCommand("WebTunnelCommand", {
		dev: {
			title: "Web tunnel",
			command: cloudflare
				.getZeroTrustTunnelCloudflaredTokenOutput({
					accountId: secrets.cloudflareAccountId.value,
					tunnelId: tunnel.id,
				})
				.token.apply((token) => `cloudflared tunnel --no-autoupdate run --token ${token}`),
		},
	});
}
