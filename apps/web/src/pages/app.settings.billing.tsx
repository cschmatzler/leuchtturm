import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { authClient } from "@chevrotain/web/clients/auth";
import { Content, Header } from "@chevrotain/web/components/app/layout";
import { Button } from "@chevrotain/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@chevrotain/web/components/ui/card";
import { reportUiError } from "@chevrotain/web/lib/report-ui-error";
import { customerStateQuery } from "@chevrotain/web/queries/billing";

export const Route = createFileRoute("/app/settings/billing")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();
	const { data: customerState } = useQuery(customerStateQuery());
	const activeSubscription = customerState?.activeSubscriptions?.[0] ?? null;
	const renewalDate = activeSubscription?.currentPeriodEnd.toLocaleDateString();
	const accessMessage = activeSubscription
		? activeSubscription.cancelAtPeriodEnd
			? t("Your subscription remains active until {{date}}.", { date: renewalDate })
			: t("Your subscription is active through {{date}}.", { date: renewalDate })
		: t("You do not have an active subscription yet.");

	const openPortal = async () => {
		try {
			await authClient.customer.portal();
		} catch (error) {
			reportUiError({ error, message: t("Could not open billing portal") });
		}
	};

	const startCheckout = async () => {
		try {
			await authClient.checkout({ slug: POLAR_PRO_PRODUCT_SLUG });
		} catch (error) {
			reportUiError({ error, message: t("Could not open checkout") });
		}
	};

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
									{t("Payment information and invoices are securely managed through Polar.")}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button variant="outline" onClick={() => void openPortal()}>
									{t("Manage billing")}
									<ExternalLinkIcon className="ml-2 size-4" />
								</Button>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>{t("Chevrotain Pro")}</CardTitle>
								<CardDescription>{accessMessage}</CardDescription>
							</CardHeader>
							<CardContent>
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
				</div>
			</Content>
		</>
	);
}
