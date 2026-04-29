export const root = "leuchtturm.dev";
export const appDomain = $app.stage === "prod" ? root : `${$app.stage}.${root}`;
export const syncDomain = $app.stage === "prod" ? `sync.${root}` : `sync.${$app.stage}.${root}`;

export const zone = cloudflare.getZoneOutput({
	filter: {
		name: root,
	},
});
