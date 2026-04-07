export const web = new sst.cloudflare.StaticSite("Web", {
	path: "apps/web",
	build: {
		command: "pnpm run build",
		output: "dist",
	},
});
