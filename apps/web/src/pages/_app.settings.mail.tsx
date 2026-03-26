import { createFileRoute } from "@tanstack/react-router";

import { MailAccountsCard } from "@chevrotain/web/pages/_app.settings.mail/-components/mail-accounts-card";

export const Route = createFileRoute("/_app/settings/mail")({
	component: Page,
});

function Page() {
	return <MailAccountsCard />;
}
