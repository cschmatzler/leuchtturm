import { createFileRoute } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

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

export const Route = createFileRoute("/app/settings/billing")({
	component: Page,
});

const PRO_PLAN_SLUG = "Chevrotain-Pro";

function Page() {
	const { t } = useTranslation();

	const openPortal = async () => {
		try {
			await authClient.customer.portal();
		} catch (error) {
			reportUiError({ error, message: t("Could not open billing portal") });
		}
	};

	const startCheckout = async () => {
		try {
			await authClient.checkout({ slug: PRO_PLAN_SLUG });
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
								<CardDescription>
									{t(
										"Start checkout in Polar to manage your subscription with the hosted billing flow.",
									)}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<Button onClick={() => void startCheckout()}>{t("Open checkout")}</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</Content>
		</>
	);
}
