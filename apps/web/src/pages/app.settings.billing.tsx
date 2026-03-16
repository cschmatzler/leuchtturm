import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { type } from "arktype";
import { useCustomer } from "autumn-js/react";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Content, Header } from "@roasted/web/components/app/layout";
import { Button } from "@roasted/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@roasted/web/components/ui/card";
import { PricingTable } from "@roasted/web/pages/app.settings.billing/-components/pricing-table";

const searchSchema = type({
	interval: type("'month' | 'year'").default(() => "month" as const),
});

export const Route = createFileRoute("/app/settings/billing")({
	component: Page,
	validateSearch: searchSchema,
	search: {
		middlewares: [stripSearchParams({ interval: "month" })],
	},
});

function Page() {
	const { t } = useTranslation();
	const { openCustomerPortal } = useCustomer();

	return (
		<>
			<Header>{t("Billing")}</Header>
			<Content>
				<div className="flex w-full flex-col items-center">
					<div className="flex w-full max-w-3xl flex-col gap-7">
						<Card>
							<CardHeader>
								<CardTitle>{t("Billing details")}</CardTitle>
								<CardDescription>
									{t("Payment information and invoices are securely managed through Stripe.")}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button
									variant="outline"
									onClick={() => openCustomerPortal({ returnUrl: window.location.href })}
								>
									{t("Manage billing")}
									<ExternalLinkIcon className="ml-2 size-4" />
								</Button>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>{t("Subscription plan")}</CardTitle>
								<CardDescription>{t("Choose the plan that best fits your needs.")}</CardDescription>
							</CardHeader>
							<CardContent>
								<PricingTable />
							</CardContent>
						</Card>
					</div>
				</div>
			</Content>
		</>
	);
}
