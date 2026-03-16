import { useNavigate } from "@tanstack/react-router";
import { CogIcon } from "lucide-react";

import { useCommandProvider } from "@one/web/hooks/use-command-provider";

export function useNavigationCommands({
	userId,
	t,
}: {
	userId: string;
	t: (key: string) => string;
}) {
	const navigate = useNavigate();

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Preferences"),
				value: "navigation-preferences",
				category: t("Navigation"),
				global: true,
				icon: CogIcon,
				run() {
					navigate({ to: "/app/settings/preferences" });
				},
			},
		],
		[navigate, userId, t],
	);
}
