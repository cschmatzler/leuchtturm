import { InboxIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { api } from "@leuchtturm/web/clients/api";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export function MailAccountsCard() {
	const { t } = useTranslation();
	const [accounts] = useZeroQuery(queries.mailAccounts());

	const handleConnectGmail = async () => {
		const data = await api.mail.mailOAuthUrl();
		window.location.href = data.url;
	};

	return (
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="px-6 py-5">
				<CardTitle className="text-base">{t("Mail accounts")}</CardTitle>
				<CardDescription>{t("Manage your connected email accounts.")}</CardDescription>
			</CardHeader>
			<CardContent className="border-t border-border px-6 py-5">
				{accounts.length > 0 && (
					<div className="mb-4 flex flex-col gap-3">
						{accounts.map((account) => (
							<div key={account.id} className="flex items-center gap-3">
								<div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
									<InboxIcon className="size-4 text-primary" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">
										{account.displayName ?? account.email}
									</p>
									<p className="truncate text-xs text-muted-foreground">{account.email}</p>
								</div>
								<StatusBadge status={account.status} />
							</div>
						))}
					</div>
				)}
				<Button size="sm" variant="outline" onClick={handleConnectGmail}>
					<PlusIcon className="size-4" />
					{t("Connect Gmail")}
				</Button>
			</CardContent>
		</Card>
	);
}

function StatusBadge({ status }: { status: string }) {
	const colors: Record<string, string> = {
		healthy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
		bootstrapping: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		connecting: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
		resyncing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		degraded: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		requires_reauth: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		paused: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
	};

	return (
		<span
			className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? colors.paused}`}
		>
			{status.replace("_", " ")}
		</span>
	);
}
