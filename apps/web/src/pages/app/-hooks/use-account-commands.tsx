import { LogOutIcon } from "lucide-react";

import { useCommandProvider } from "@one/web/hooks/use-command-provider";
import { renderOptionShiftShortcut } from "@one/web/pages/app/-hooks/shortcut-kbd";

export function useAccountCommands({
	userId,
	t,
	onSignOut,
}: {
	userId: string;
	t: (key: string) => string;
	onSignOut: () => Promise<void>;
}) {
	useCommandProvider(
		"account",
		async () => [
			{
				title: t("Log out"),
				category: t("Account"),
				global: true,
				icon: LogOutIcon,
				shortcut: () => renderOptionShiftShortcut("Q"),
				async run() {
					await onSignOut();
				},
			},
		],
		[userId, onSignOut, t],
	);
}
