import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InboxIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@chevrotain/web/components/app/layout";
import { Button } from "@chevrotain/web/components/ui/button";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { queries } from "@chevrotain/zero/queries";
import type { MailAccountRow } from "@chevrotain/zero/schema";

export const Route = createFileRoute("/app/mail/")({
	component: MailIndexPage,
});

function MailIndexPage() {
	const { t } = useTranslation();
	const [accounts] = useZeroQuery(queries.mailAccounts());

	const handleConnectGmail = async () => {
		const res = await fetch("/api/mail/oauth/url");
		const data = (await res.json()) as { url: string };
		window.location.href = data.url;
	};

	return (
		<>
			<Header>
				{t("Mail")}
				<Button size="sm" variant="outline" onClick={handleConnectGmail}>
					<PlusIcon className="size-4" />
					{t("Connect Gmail")}
				</Button>
			</Header>
			<Content>
				{accounts.length === 0 ? (
					<EmptyState onConnect={handleConnectGmail} />
				) : (
					<AccountList accounts={accounts} />
				)}
			</Content>
		</>
	);
}

function EmptyState({ onConnect }: { onConnect: () => void }) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
			<div className="flex size-16 items-center justify-center rounded-full bg-muted">
				<InboxIcon className="size-8 text-muted-foreground" />
			</div>
			<div className="text-center">
				<h2 className="text-lg font-semibold">{t("No mail accounts connected")}</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					{t("Connect a Gmail account to get started.")}
				</p>
			</div>
			<Button onClick={onConnect}>
				<PlusIcon className="size-4" />
				{t("Connect Gmail")}
			</Button>
		</div>
	);
}

function AccountList({ accounts }: { accounts: readonly MailAccountRow[] }) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	return (
		<div className="mx-auto w-full max-w-3xl">
			<div className="mb-6">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Mail Accounts")}</h1>
				<p className="mt-1 text-sm text-muted-foreground">{t("Your connected email accounts.")}</p>
			</div>
			<div className="flex flex-col gap-3">
				{accounts.map((account) => (
					<button
						key={account.id}
						type="button"
						className="flex items-center gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent"
						onClick={() =>
							navigate({
								to: "/app/mail/$accountId",
								params: { accountId: account.id },
							})
						}
					>
						<div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
							<InboxIcon className="size-5 text-primary" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{account.displayName ?? account.email}</p>
							<p className="truncate text-sm text-muted-foreground">{account.email}</p>
						</div>
						<StatusBadge status={account.status} />
					</button>
				))}
			</div>
		</div>
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
