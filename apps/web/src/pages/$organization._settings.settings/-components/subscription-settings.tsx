import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { T, useGT, Var } from "gt-react";

import { api } from "@leuchtturm/web/clients/api";
import { Button } from "@leuchtturm/web/components/ui/button";
import { reportError } from "@leuchtturm/web/lib/report-error";
import { billingOverviewQuery } from "@leuchtturm/web/queries/billing";

export function SubscriptionSettings() {
	const { organizationId } = useRouteContext({ from: "/$organization/_settings/settings/billing" });
	const t = useGT();
	const { data: billingOverview } = useQuery(billingOverviewQuery(organizationId));
	const activeSubscription = billingOverview?.activeSubscription ?? null;
	const renewalDate = activeSubscription?.currentPeriodEnd.toLocaleDateString();
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
				<h2 className="text-lg font-semibold">
					<T>Leuchtturm Pro</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					{activeSubscription ? (
						activeSubscription.cancelAtPeriodEnd ? (
							<T>
								Your subscription remains active until <Var>{renewalDate}</Var>.
							</T>
						) : (
							<T>
								Your subscription is active through <Var>{renewalDate}</Var>.
							</T>
						)
					) : (
						<T>You do not have an active subscription yet.</T>
					)}
				</p>
			</div>
			<div className="mt-5">
				{activeSubscription ? (
					<Button variant="outline" onClick={() => void openPortal()}>
						<T>Manage subscription in Polar</T>
					</Button>
				) : (
					<Button onClick={() => void startCheckout()}>
						<T>Open checkout</T>
					</Button>
				)}
			</div>
		</section>
	);
}
