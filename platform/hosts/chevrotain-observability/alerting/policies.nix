{
	apiVersion = 1;
	policies = [
		{
			orgId = 1;
			receiver = "chevrotain-discord";
			group_by = [
				"alertname"
				"service"
				"severity"
			];
			group_wait = "30s";
			group_interval = "5m";
			repeat_interval = "4h";
		}
	];
}
