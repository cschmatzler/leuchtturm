import { createFileRoute, Navigate } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@chevrotain/web/components/app/layout";
import { Link } from "@chevrotain/web/components/ui/link";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/_app/mail")({
	loader: async ({ context: { zero } }) => {
		zero.preload(queries.mailAccounts());
	},
	component: MailPage,
});

function MailPage() {
	const { t } = useTranslation();
	const [accounts] = useZeroQuery(queries.mailAccounts());

	if (accounts.length > 0) {
		return <Navigate to="/mac_{$accountId}" params={{ accountId: accounts[0].id }} replace />;
	}

	return (
		<>
			<Header>{t("Mail")}</Header>
			<Content>
				<div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
					<div className="flex size-16 items-center justify-center rounded-full bg-muted">
						<InboxIcon className="size-8 text-muted-foreground" />
					</div>
					<div className="text-center">
						<h2 className="text-lg font-semibold">{t("No mail accounts connected")}</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("Connect a Gmail account in")}{" "}
							<Link to="/settings/preferences" className="text-foreground underline">
								{t("Preferences")}
							</Link>
							{t(" to get started.")}
						</p>
					</div>
				</div>
			</Content>
		</>
	);
}
