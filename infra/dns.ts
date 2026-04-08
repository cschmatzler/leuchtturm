export const root = "leuchtturm.dev";
export const appDomain = $app.stage === "production" ? root : `${$app.stage}.${root}`;
export const syncDomain =
	$app.stage === "production" ? `sync.${root}` : `sync.${$app.stage}.${root}`;

export const zone = cloudflare.getZoneOutput({
	filter: {
		name: root,
	},
});

new cloudflare.DnsRecord("Placeholder", {
	zoneId: zone.zoneId,
	name: appDomain,
	type: "AAAA",
	content: "100::",
	proxied: true,
	ttl: 1,
});
