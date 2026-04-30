import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { useRouteContext } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { api } from "@leuchtturm/web/clients/api";
import { Button } from "@leuchtturm/web/components/ui/button";
import { reportError } from "@leuchtturm/web/lib/report-error";

export function BillingDetails() {
	const { organizationId } = useRouteContext({ from: "/$organization/_settings/settings/billing" });
	const { t } = useTranslation();

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

	return (
		<section className="py-6">
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{t("Billing details")}</h2>
				<p className="text-sm text-muted-foreground">
					{t("Payment information and invoices are securely managed through Polar.")}
				</p>
			</div>
			<div className="mt-5">
				<Button variant="outline" onClick={() => void openPortal()}>
					{t("Manage billing")}
					<ArrowSquareOutIcon className="ml-2 size-4" />
				</Button>
			</div>
		</section>
	);
}
