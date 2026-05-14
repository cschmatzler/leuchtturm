import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { createFileRoute } from "@tanstack/react-router";
import { useCustomer } from "autumn-js/react";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { PricingTable } from "@leuchtturm/web/components/billing/pricing-table";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldLabel } from "@leuchtturm/web/components/ui/field";
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
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<section>
				<div className="space-y-1">
					<h2 className="font-serif text-2xl">
						<T>Billing details</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Payment information and invoices are securely managed through Stripe.</T>
					</p>
				</div>
				<div className="mt-5 grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
					<div>
						<FieldLabel>
							<T>Billing portal</T>
						</FieldLabel>
						<FieldDescription className="mt-1">
							<T>Update payment methods, billing details, and invoices.</T>
						</FieldDescription>
					</div>
					<div className="flex justify-end">
						<Button variant="outline" onClick={() => openPortal()}>
							<T>Manage billing</T>
							<ArrowSquareOutIcon data-icon="inline-end" />
						</Button>
					</div>
				</div>
			</section>
			<section>
				<div className="space-y-1">
					<h2 className="font-serif text-2xl">
						<T>Subscription plan</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Choose the plan that best fits your needs.</T>
					</p>
				</div>
				<div className="mt-5">
					<PricingTable />
				</div>
			</section>
		</div>
	);
}
