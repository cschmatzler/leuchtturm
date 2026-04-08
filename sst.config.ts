export default $config({
	app(input) {
		return {
			name: "leuchtturm",
			home: "cloudflare",
			providers: {
				aws: {
					region: "eu-central-1",
				},
				"@cloudyskysoftware/pulumi-render": "0.5.5",
				cloudflare: "6.13.0",
				planetscale: "1.0.0",
			},
			// protect: input.stage === "production",
			// removal: input.stage === "production" ? "retain" : "remove",
		};
	},
	async run() {
		await import("@leuchtturm/infra/dns");
		await import("@leuchtturm/infra/secrets");
		await import("@leuchtturm/infra/database");
		await import("@leuchtturm/infra/api");
		await import("@leuchtturm/infra/web");
		await import("@leuchtturm/infra/routes");
		await import("@leuchtturm/infra/zero");
	},
});
