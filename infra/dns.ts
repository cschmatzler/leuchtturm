import { appDomain, rootDomain } from "@chevrotain/infra/stage";

export const zone = cloudflare.getZoneOutput({
	filter: {
		name: rootDomain,
	},
});

export const webRoutesDns = new cloudflare.DnsRecord("WebRoutesDns", {
	zoneId: zone.zoneId,
	name: appDomain,
	type: "AAAA",
	content: "100::",
	proxied: true,
	ttl: 1,
});
