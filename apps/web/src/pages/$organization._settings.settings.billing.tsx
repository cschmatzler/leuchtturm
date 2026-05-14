import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { createFileRoute } from "@tanstack/react-router";
import { useCustomer } from "autumn-js/react";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { PricingTable } from "@leuchtturm/web/components/billing/pricing-table";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { reportError } from "@leuchtturm/web/lib/report-error";

export const Route = createFileRoute("/$organization/_settings/settings/billing")({
	component: Page,
});

function Page() {
	const { openCustomerPortal } = useCustomer();
	const t = useGT();

	async function openPortal() {
		try {
			await openCustomerPortal({ returnUrl: window.location.href });
		} catch (error) {
			toast.error(t("Could not open billing portal."));
			reportError(error, t("Could not open billing portal."), {
				source: "billing-settings",
			});
		}
	}

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6 py-6">
			<Card>
				<CardHeader>
					<CardTitle>
						<T>Billing details</T>
					</CardTitle>
					<CardDescription>
						<T>Payment information and invoices are securely managed through Stripe.</T>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button variant="outline" onClick={() => openPortal()}>
						<T>Manage billing</T>
						<ArrowSquareOutIcon data-icon="inline-end" />
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>
						<T>Subscription plan</T>
					</CardTitle>
					<CardDescription>
						<T>Choose the plan that best fits your needs.</T>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<PricingTable />
				</CardContent>
			</Card>
		</div>
	);
}
