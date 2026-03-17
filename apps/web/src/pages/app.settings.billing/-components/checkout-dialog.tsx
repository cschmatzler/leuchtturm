import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import {
	useCustomer,
	useListPlans,
	type ClientAttachParams,
	type UseCustomerResult,
} from "autumn-js/react";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";

type Plan = NonNullable<ReturnType<typeof useListPlans>["data"]>[number];
type PreviewAttachResponse = Awaited<ReturnType<UseCustomerResult["previewAttach"]>>;
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
} from "@chevrotain/web/components/ui/accordion";
import { Button } from "@chevrotain/web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@chevrotain/web/components/ui/dialog";
import { cn } from "@chevrotain/web/lib/cn";
import { reportUiError } from "@chevrotain/web/lib/report-ui-error";

function formatCurrency({ amount, currency }: { amount: number; currency: string }) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

function getCheckoutContent(
	plan: Plan,
	preview: PreviewAttachResponse,
	t: (key: string, options?: Record<string, unknown>) => string,
) {
	const scenario = plan.customerEligibility?.scenario;
	const isFree = plan.price === null;
	const isOneOff = plan.price?.interval === "one_off";
	const hasTrial = plan.customerEligibility?.trialAvailable && plan.freeTrial !== undefined;

	const nextCycleAtStr = preview.nextCycle
		? new Date(preview.nextCycle.startsAt).toLocaleDateString()
		: undefined;

	const productName = plan.name;

	if (isOneOff) {
		return {
			title: t("Purchase {{productName}}", { productName }),
			message: t(
				"By clicking confirm, you will purchase {{productName}} and your card will be charged immediately.",
				{ productName },
			),
		};
	}

	if (hasTrial) {
		return {
			title: t("Start trial for {{productName}}", { productName }),
			message: t(
				"By clicking confirm, you will start a free trial of {{productName}} which ends on {{nextCycleAt}}.",
				{ productName, nextCycleAt: nextCycleAtStr },
			),
		};
	}

	switch (scenario) {
		case "scheduled":
			return {
				title: t("{{productName}} product already scheduled", { productName }),
				message: t("You are currently scheduled to start {{productName}} on {{nextCycleAt}}.", {
					productName,
					nextCycleAt: nextCycleAtStr,
				}),
			};

		case "active":
			return {
				title: t("Product already active"),
				message: t("You are already subscribed to this product."),
			};

		case "new":
			if (isFree) {
				return {
					title: t("Enable {{productName}}", { productName }),
					message: t("By clicking confirm, {{productName}} will be enabled immediately.", {
						productName,
					}),
				};
			}

			return {
				title: t("Subscribe to {{productName}}", { productName }),
				message: t(
					"By clicking confirm, you will be subscribed to {{productName}} and your card will be charged immediately.",
					{ productName },
				),
			};
		case "renew":
			return {
				title: t("Renew"),
				message: t("By clicking confirm, you will renew your subscription to {{productName}}.", {
					productName,
				}),
			};

		case "upgrade":
			return {
				title: t("Upgrade to {{productName}}", { productName }),
				message: t(
					"By clicking confirm, you will upgrade to {{productName}} and your payment method will be charged immediately.",
					{ productName },
				),
			};

		case "downgrade":
			return {
				title: t("Downgrade to {{productName}}", { productName }),
				message: t(
					"By clicking confirm, your current subscription will be cancelled and a new subscription to {{productName}} will begin on {{nextCycleAt}}.",
					{ productName, nextCycleAt: nextCycleAtStr },
				),
			};

		case "cancel":
			return {
				title: t("Cancel"),
				message: t("By clicking confirm, your current subscription will end on {{nextCycleAt}}.", {
					nextCycleAt: nextCycleAtStr,
				}),
			};

		default:
			return {
				title: t("Change Subscription"),
				message: t("You are about to change your subscription."),
			};
	}
}

export function getButtonText(plan: Plan, t: (key: string) => string) {
	const scenario = plan.customerEligibility?.scenario;
	const hasTrial = plan.customerEligibility?.trialAvailable && plan.freeTrial !== undefined;
	const isOneOff = plan.price?.interval === "one_off";
	const hasPrepaid = plan.items.some((item) => item.price?.billingMethod === "prepaid");

	if (hasTrial) {
		return t("Start Free Trial");
	}

	switch (scenario) {
		case "scheduled":
			return t("Plan Scheduled");

		case "active":
			if (hasPrepaid) {
				return t("Update Plan");
			}
			return t("Current Plan");

		case "new":
			if (isOneOff) {
				return t("Purchase");
			}
			return t("Get started");

		case "renew":
			return t("Renew");

		case "upgrade":
			return t("Upgrade");

		case "downgrade":
			return t("Downgrade");

		case "cancel":
			return t("Cancel Plan");

		default:
			return t("Get Started");
	}
}

export default function CheckoutDialog({
	open,
	setOpen: onOpenChange,
	preview: initialPreview,
	plan,
	attachParams,
}: {
	open: boolean;
	setOpen: (open: boolean) => void;
	preview: PreviewAttachResponse;
	plan: Plan;
	attachParams?: Omit<ClientAttachParams, "planId">;
}) {
	const { t } = useTranslation();
	const { attach } = useCustomer();

	const [preview, setPreview] = useState<PreviewAttachResponse | undefined>(initialPreview);
	const [prevPreview, setPrevPreview] = useState(initialPreview);
	const [isLoading, setIsLoading] = useState(false);

	if (initialPreview !== prevPreview) {
		setPrevPreview(initialPreview);
		if (initialPreview) {
			setPreview(initialPreview);
		}
	}

	if (!preview) {
		return null;
	}

	const { title, message } = getCheckoutContent(plan, preview, t);

	const isFree = plan.price === null;
	const isPaid = !isFree;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{message}</DialogDescription>
				</DialogHeader>
				{isPaid && <PriceInformation preview={preview} />}
				<DialogFooter>
					<Button
						size="sm"
						onClick={async () => {
							setIsLoading(true);
							try {
								const featureQuantities = preview.incoming.flatMap(
									(incoming) => incoming.featureQuantities,
								);

								await attach({
									planId: plan.id,
									...attachParams,
									featureQuantities: featureQuantities.length > 0 ? featureQuantities : undefined,
								});
								onOpenChange(false);
							} catch (error) {
								reportUiError({ error, message: t("Could not complete checkout") });
							} finally {
								setIsLoading(false);
							}
						}}
						disabled={isLoading}
					>
						{isLoading ? <Loader2Icon className="size-4 animate-spin" /> : t("Confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PriceInformation({ preview }: { preview: PreviewAttachResponse }) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				{preview.lineItems.length > 1 && <CheckoutLines preview={preview} />}
				<DueAmounts preview={preview} />
			</div>
		</div>
	);
}

function DueAmounts({ preview }: { preview: PreviewAttachResponse }) {
	const { t } = useTranslation();
	const { nextCycle } = preview;
	const nextCycleAtStr = nextCycle ? new Date(nextCycle.startsAt).toLocaleDateString() : undefined;

	const showNextCycle = nextCycle && nextCycle.total !== preview.total;

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between">
				<p className="text-sm font-medium">{t("Total due today")}</p>
				<p className="text-sm font-medium">
					{formatCurrency({
						amount: preview.total,
						currency: preview.currency,
					})}
				</p>
			</div>
			{showNextCycle && (
				<div className="text-muted-foreground flex justify-between text-sm">
					<p>
						{t("Due next cycle")} ({nextCycleAtStr})
					</p>
					<p>
						{formatCurrency({
							amount: nextCycle.total,
							currency: preview.currency,
						})}
					</p>
				</div>
			)}
		</div>
	);
}

function CheckoutLines({ preview }: { preview: PreviewAttachResponse }) {
	const { t } = useTranslation();
	return (
		<Accordion>
			<AccordionItem value="total" className="border-b-0">
				<CustomAccordionTrigger className="w-full justify-between border-none py-0">
					<div className="flex w-full cursor-pointer items-center justify-end gap-1">
						<p className="text-muted-foreground text-sm font-normal">{t("View details")}</p>
						<ChevronDownIcon className="text-muted-foreground size-3.5 rotate-90 transition-transform duration-200 ease-in-out" />
					</div>
				</CustomAccordionTrigger>
				<AccordionContent className="mt-2 mb-0 flex flex-col gap-2 pb-2">
					{preview.lineItems
						.filter((line) => line.total !== 0)
						.map((line) => {
							return (
								<div key={line.description} className="flex justify-between">
									<p className="text-muted-foreground text-sm">{line.displayName}</p>
									<p className="text-muted-foreground text-sm">
										{formatCurrency({
											amount: line.total,
											currency: preview.currency,
										})}
									</p>
								</div>
							);
						})}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

function CustomAccordionTrigger({
	className,
	children,
	...props
}: ComponentProps<typeof BaseAccordion.Trigger>) {
	return (
		<BaseAccordion.Header className="flex">
			<BaseAccordion.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-panel-open]_svg]:rotate-0",
					className,
				)}
				{...props}
			>
				{children}
			</BaseAccordion.Trigger>
		</BaseAccordion.Header>
	);
}
