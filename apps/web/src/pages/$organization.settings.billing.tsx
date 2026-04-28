import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
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
import { reportError } from "@leuchtturm/web/lib/report-error";
import { billingOverviewQuery } from "@leuchtturm/web/queries/billing";

export const Route = createFileRoute("/$organization/settings/billing")({
	component: Page,
});

function Page() {
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const { data: billingOverview } = useQuery(billingOverviewQuery(organizationId));
	const activeSubscription = billingOverview?.activeSubscription ?? null;
	const renewalDate = activeSubscription?.currentPeriodEnd.toLocaleDateString();
	const accessMessage = activeSubscription
		? activeSubscription.cancelAtPeriodEnd
			? t("Your subscription remains active until {{date}}.", { date: renewalDate })
			: t("Your subscription is active through {{date}}.", { date: renewalDate })
		: t("You do not have an active subscription yet.");

	const openPortal = async () => {
		try {
			const { url } = await api.billing.portal({ query: { organizationId } });
			window.location.assign(url);
		} catch (error) {
			reportError(error, t("Could not open billing portal"), {
				source: "billing-settings",
			});
		}
	};

	const startCheckout = async () => {
		try {
			const { url } = await api.billing.checkout({ query: { organizationId } });
			window.location.assign(url);
		} catch (error) {
			reportError(error, t("Could not open checkout"), {
				source: "billing-settings",
			});
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Billing details")}</CardTitle>
					<CardDescription>
						{t("Payment information and invoices are securely managed through Polar.")}
					</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border px-6 py-5">
					<Button variant="outline" onClick={() => void openPortal()}>
						{t("Manage billing")}
						<ExternalLinkIcon className="ml-2 size-4" />
					</Button>
				</CardContent>
			</Card>

			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Leuchtturm Pro")}</CardTitle>
					<CardDescription>{accessMessage}</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border px-6 py-5">
					{activeSubscription ? (
						<Button variant="outline" onClick={() => void openPortal()}>
							{t("Manage subscription in Polar")}
						</Button>
					) : (
						<Button onClick={() => void startCheckout()}>{t("Open checkout")}</Button>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
