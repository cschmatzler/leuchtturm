export default $config({
	app(input) {
		return {
			name: "chevrotain",
			home: "cloudflare",
			providers: {
				aws: {
					region: "eu-central-1",
				},
				cloudflare: "6.13.0",
				planetscale: "1.0.0",
			},
			protect: input.stage === "production",
			removal: input.stage === "production" ? "retain" : "remove",
		};
	},
	async run() {
		const [{ api }, { zone }, { apiUrl, appDomain, webUrl }, { web }, { zeroUrl }] =
			await Promise.all([
				import("@chevrotain/infra/api"),
				import("@chevrotain/infra/dns"),
				import("@chevrotain/infra/stage"),
				import("@chevrotain/infra/web"),
				import("@chevrotain/infra/zero"),
			]);

		new cloudflare.WorkersRoute("ApiRoute", {
			zoneId: zone.zoneId,
			pattern: `${appDomain}/api`,
			script: api.nodes.worker.scriptName,
		});

		new cloudflare.WorkersRoute("ApiWildcardRoute", {
			zoneId: zone.zoneId,
			pattern: `${appDomain}/api/*`,
			script: api.nodes.worker.scriptName,
		});

		new cloudflare.WorkersRoute("WebRoute", {
			zoneId: zone.zoneId,
			pattern: appDomain,
			script: web.nodes.router.nodes.worker.scriptName,
		});

		new cloudflare.WorkersRoute("WebWildcardRoute", {
			zoneId: zone.zoneId,
			pattern: `${appDomain}/*`,
			script: web.nodes.router.nodes.worker.scriptName,
		});

		return {
			api: apiUrl,
			web: webUrl,
			zero: zeroUrl,
		};
	},
});
