import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { T, useGT, Var } from "gt-react";

import { api } from "@leuchtturm/web/clients/api";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { reportError } from "@leuchtturm/web/lib/report-error";
import { billingOverviewQuery } from "@leuchtturm/web/queries/billing";

export const Route = createFileRoute("/$organization/_settings/settings/billing")({
	component: Page,
});

function Page() {
	const { organizationId } = Route.useRouteContext();

	const { data: billingOverview } = useQuery(billingOverviewQuery(organizationId));

	const t = useGT();

	const activeSubscription = billingOverview?.activeSubscription ?? null;
	const renewalDate = activeSubscription?.currentPeriodEnd.toLocaleDateString();
	const openPortal = async () => {
		try {
			const { url } = await api.billing.portal({ query: { organizationId } });
			window.location.assign(url);
		} catch (error) {
			reportError(error, t("Could not open billing portal."), {
				source: "billing-settings",
			});
		}
	};

	const startCheckout = async () => {
		try {
			const { url } = await api.billing.checkout({ query: { organizationId } });
			window.location.assign(url);
		} catch (error) {
			reportError(error, t("Could not open checkout."), {
				source: "billing-settings",
			});
		}
	};

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="font-serif text-2xl">
						<T>Billing details</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Payment information and invoices are securely managed through Polar.</T>
					</p>
				</div>
				<div className="mt-5">
					<Button variant="outline" onClick={() => openPortal()}>
						<T>Manage billing</T>
						<ArrowSquareOutIcon className="ml-2 size-4" />
					</Button>
				</div>
			</section>
			<Separator />
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="font-serif text-2xl">
						<T>Leuchtturm Pro</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<Show
							when={activeSubscription}
							fallback={<T>You do not have an active subscription yet.</T>}
						>
							{(subscription) => (
								<Show
									when={subscription.cancelAtPeriodEnd}
									fallback={
										<T>
											Your subscription is active through <Var>{renewalDate}</Var>.
										</T>
									}
								>
									<T>
										Your subscription remains active until <Var>{renewalDate}</Var>.
									</T>
								</Show>
							)}
						</Show>
					</p>
				</div>
				<div className="mt-5">
					<Show
						when={activeSubscription}
						fallback={
							<Button onClick={() => startCheckout()}>
								<T>Open checkout</T>
							</Button>
						}
					>
						<Button variant="outline" onClick={() => openPortal()}>
							<T>Manage subscription in Polar</T>
						</Button>
					</Show>
				</div>
			</section>
		</div>
	);
}
