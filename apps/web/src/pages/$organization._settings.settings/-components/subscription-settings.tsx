import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { api } from "@leuchtturm/web/clients/api";
import { Button } from "@leuchtturm/web/components/ui/button";
import { reportError } from "@leuchtturm/web/lib/report-error";
import { billingOverviewQuery } from "@leuchtturm/web/queries/billing";

export function SubscriptionSettings() {
	const { organizationId } = useRouteContext({ from: "/$organization/_settings/settings/billing" });
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
		<section className="py-6">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{t("Leuchtturm Pro")}</h2>
				<p className="text-sm text-muted-foreground">{accessMessage}</p>
			</div>
			<div className="mt-5">
				{activeSubscription ? (
					<Button variant="outline" onClick={() => void openPortal()}>
						{t("Manage subscription in Polar")}
					</Button>
				) : (
					<Button onClick={() => void startCheckout()}>{t("Open checkout")}</Button>
				)}
			</div>
		</section>
	);
}
