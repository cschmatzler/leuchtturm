{
	apiVersion = 1;
	contactPoints = [
		{
			orgId = 1;
			name = "chevrotain-discord";
			receivers = [
				{
					uid = "chevrotain_discord";
					type = "discord";
					disableResolveMessage = false;
					settings = {
						url = "$GRAFANA_DISCORD_WEBHOOK_URL";
						use_discord_username = false;
						message = ''							{{ template "default.title" . }}

							{{ template "default.message" . }}'';
					};
				}
			];
		}
	];
}
