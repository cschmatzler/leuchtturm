export const polarConfig = new sst.Linkable("Polar", {
	properties: {
		Server: $app.stage === "prod" ? "production" : "sandbox",
	},
});
