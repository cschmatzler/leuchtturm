export default $config({
	app(input) {
		return {
			name: "leuchtturm",
			home: "cloudflare",
			providers: {
				"@cloudyskysoftware/pulumi-render": "0.5.5",
				cloudflare: "6.13.0",
				grafana: "2.29.0",
				planetscale: "1.0.0",
			},
			protect: input.stage === "prod",
			removal: input.stage === "prod" ? "retain" : "remove",
		};
	},
	async run() {
		await import("@leuchtturm/infra/dns");
		await import("@leuchtturm/infra/secrets");
		await import("@leuchtturm/infra/grafana");
		await import("@leuchtturm/infra/database");
		await import("@leuchtturm/infra/api");
		await import("@leuchtturm/infra/web");
		await import("@leuchtturm/infra/access");
		await import("@leuchtturm/infra/zero");
	},
});
