import { createFileRoute } from "@tanstack/react-router";

import { Separator } from "@leuchtturm/web/components/ui/separator";
import { BillingDetails } from "@leuchtturm/web/pages/$organization._settings.settings/-components/billing-details";
import { SubscriptionSettings } from "@leuchtturm/web/pages/$organization._settings.settings/-components/subscription-settings";

export const Route = createFileRoute("/$organization/_settings/settings/billing")({
	component: Page,
});

function Page() {
	return (
		<div className="mx-auto w-full max-w-3xl">
			<BillingDetails />
			<Separator />
			<SubscriptionSettings />
		</div>
	);
}
