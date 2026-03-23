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
				<div className="mx-auto w-full max-w-3xl">
					<div className="mb-8">
						<h1 className="text-2xl font-semibold tracking-tight">{t("Billing")}</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("Manage your subscription and payment details.")}
						</p>
					</div>
					<div className="flex flex-col gap-8">
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
								<CardTitle className="text-base">{t("Chevrotain Pro")}</CardTitle>
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
				</div>
			</Content>
		</>
	);
}
