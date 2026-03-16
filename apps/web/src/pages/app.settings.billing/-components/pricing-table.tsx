import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCustomer, useListPlans, type UseCustomerResult } from "autumn-js/react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import {
	createContext,
	useContext,
	useState,
	type ComponentProps,
	type MouseEvent,
	type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

type Plan = NonNullable<ReturnType<typeof useListPlans>["data"]>[number];
type PreviewAttachResponse = Awaited<ReturnType<NonNullable<UseCustomerResult["previewAttach"]>>>;

import { Button } from "@roasted/web/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@roasted/web/components/ui/card";
import { Switch } from "@roasted/web/components/ui/switch";
import { cn } from "@roasted/web/lib/cn";
import { reportUiError } from "@roasted/web/lib/report-ui-error";
import CheckoutDialog, {
	getButtonText,
} from "@roasted/web/pages/app.settings.billing/-components/checkout-dialog";

export function PricingTable() {
	const navigate = useNavigate({ from: "/app/settings/billing" });
	const { interval } = useSearch({ from: "/app/settings/billing" });
	const { data: customer, attach, previewAttach } = useCustomer({ errorOnNotFound: false });
	const { data: plans, isLoading, error } = useListPlans();
	const isAnnual = interval === "year";

	const [checkoutOpen, setCheckoutOpen] = useState(false);
	const [checkoutPreview, setCheckoutPreview] = useState<PreviewAttachResponse | undefined>();
	const [checkoutPlan, setCheckoutPlan] = useState<Plan | undefined>();

	if (isLoading) {
		return (
			<div className="flex h-full min-h-[300px] w-full items-center justify-center">
				<Loader2Icon className="text-muted-foreground size-6 animate-spin" />
			</div>
		);
	}

	if (error) {
		return <div className="text-muted-foreground text-sm">Something went wrong...</div>;
	}

	const intervals = Array.from(
		new Set(plans?.map((p: Plan) => p.price?.interval).filter((i) => !!i && i !== "one_off")),
	);

	const hasMonthAndYear =
		intervals.some((i) => i === "month") && intervals.some((i) => i === "year");

	const intervalFilter = (plan: Plan) => {
		if (!plan.price?.interval || plan.price.interval === "one_off") {
			return true;
		}

		if (hasMonthAndYear) {
			if (isAnnual) {
				return plan.price.interval === "year";
			} else {
				return plan.price.interval === "month";
			}
		}

		return true;
	};

	const handleIntervalChange = (nextAnnual: boolean) => {
		navigate({
			search: (prev) => ({ ...prev, interval: nextAnnual ? "year" : "month" }),
		});
	};

	const handlePlanClick = async (plan: Plan) => {
		if (!customer) return;

		try {
			const preview = await previewAttach({ planId: plan.id });
			setCheckoutPlan(plan);
			setCheckoutPreview(preview);
			setCheckoutOpen(true);
		} catch (error) {
			// If preview fails, try direct attach (handles redirect to Stripe)
			try {
				await attach({ planId: plan.id });
			} catch (attachError) {
				reportUiError({ error: attachError, message: "Could not open checkout" });
			}
		}
	};

	return (
		<div>
			{plans && (
				<>
					<PricingTableContainer
						plans={plans}
						isAnnualToggle={isAnnual}
						setIsAnnualToggle={handleIntervalChange}
						multiInterval={hasMonthAndYear}
					>
						{plans.filter(intervalFilter).map((plan: Plan) => (
							<PricingCard
								key={plan.id}
								planId={plan.id}
								buttonProps={{
									disabled:
										(plan.customerEligibility?.scenario === "active" &&
											!plan.items.some((item) => item.price?.billingMethod === "prepaid")) ||
										plan.customerEligibility?.scenario === "scheduled",
									onClick: async () => {
										await handlePlanClick(plan);
									},
								}}
							/>
						))}
					</PricingTableContainer>
					{checkoutPlan && checkoutPreview && (
						<CheckoutDialog
							open={checkoutOpen}
							setOpen={setCheckoutOpen}
							preview={checkoutPreview}
							plan={checkoutPlan}
						/>
					)}
				</>
			)}
		</div>
	);
}

const PricingTableContext = createContext<{
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
	plans: Plan[];
	showFeatures: boolean;
}>({
	isAnnualToggle: false,
	setIsAnnualToggle: () => {},
	plans: [],
	showFeatures: true,
});

function usePricingTableContext(componentName: string) {
	const context = useContext(PricingTableContext);

	if (context === undefined) {
		throw new Error(`${componentName} must be used within <PricingTable />`);
	}

	return context;
}

function PricingTableContainer({
	children,
	plans,
	showFeatures = true,
	className,
	isAnnualToggle,
	setIsAnnualToggle,
	multiInterval,
}: {
	children?: ReactNode;
	plans?: Plan[];
	showFeatures?: boolean;
	className?: string;
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
	multiInterval: boolean;
}) {
	if (!plans) {
		throw new Error("plans is required in <PricingTable />");
	}

	if (plans.length === 0) {
		return null;
	}

	return (
		<PricingTableContext.Provider
			value={{ isAnnualToggle, setIsAnnualToggle, plans, showFeatures }}
		>
			<div className={cn("flex flex-col items-center")}>
				{multiInterval && (
					<div className="mb-8">
						<AnnualSwitch isAnnualToggle={isAnnualToggle} setIsAnnualToggle={setIsAnnualToggle} />
					</div>
				)}
				<div
					className={cn(
						"grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]",
						className,
					)}
				>
					{children}
				</div>
			</div>
		</PricingTableContext.Provider>
	);
}

function PricingCard({
	planId,
	className,
	buttonProps,
}: {
	planId: string;
	className?: string;
	buttonProps?: ComponentProps<"button">;
}) {
	const { t } = useTranslation();
	const { plans, showFeatures } = usePricingTableContext("PricingCard");

	const plan = plans.find((p) => p.id === planId);

	if (!plan) {
		throw new Error(`Plan with id ${planId} not found`);
	}
	const { name } = plan;
	const buttonText = getButtonText(plan, t);

	const isFree = plan.price === null;
	const mainPriceDisplay = isFree
		? { primaryText: t("Free") }
		: (plan.price?.display ?? plan.items[0]?.display);

	const featureItems = isFree ? plan.items : plan.items.slice(1);

	return (
		<Card className={cn("relative h-full w-full max-w-xl", className)}>
			<CardHeader>
				<CardTitle className="text-xl">{name}</CardTitle>
				{plan.description && (
					<p className="text-muted-foreground line-clamp-2 text-sm">{plan.description}</p>
				)}
			</CardHeader>
			<CardContent className="flex flex-grow flex-col gap-6">
				<div className="flex items-baseline gap-1">
					<span className="text-3xl font-semibold">{mainPriceDisplay?.primaryText}</span>
					{mainPriceDisplay?.secondaryText && (
						<span className="text-muted-foreground text-sm">{mainPriceDisplay.secondaryText}</span>
					)}
				</div>
				{showFeatures && featureItems.length > 0 && <PricingFeatureList items={featureItems} />}
			</CardContent>
			<CardFooter>
				<PricingCardButton {...buttonProps}>{buttonText}</PricingCardButton>
			</CardFooter>
		</Card>
	);
}

function PricingFeatureList({ items, className }: { items: Plan["items"]; className?: string }) {
	return (
		<div className={cn("flex-grow", className)}>
			<ul className="space-y-2.5">
				{items.map((item) => (
					<li
						key={item.display?.primaryText ?? item.featureId}
						className="flex items-start gap-2.5 text-sm"
					>
						<CheckIcon className="text-primary mt-0.5 size-4 shrink-0" />
						<div className="flex flex-col">
							<span>{item.display?.primaryText}</span>
							{item.display?.secondaryText && (
								<span className="text-muted-foreground text-sm">{item.display?.secondaryText}</span>
							)}
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

type PricingCardButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
	onClick?: (e: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

function PricingCardButton({
	children,
	className,
	onClick,
	ref,
	...props
}: PricingCardButtonProps) {
	const { t } = useTranslation();
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
		setIsLoading(true);
		try {
			await onClick?.(e);
		} catch (error) {
			reportUiError({ error, message: t("Could not open checkout") });
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Button
			className={cn("w-full", className)}
			variant="secondary"
			ref={ref}
			disabled={isLoading || props.disabled}
			onClick={handleClick}
			{...props}
		>
			{isLoading ? <Loader2Icon className="size-4 animate-spin" /> : children}
		</Button>
	);
}

function AnnualSwitch({
	isAnnualToggle,
	setIsAnnualToggle,
}: {
	isAnnualToggle: boolean;
	setIsAnnualToggle: (isAnnual: boolean) => void;
}) {
	const { t } = useTranslation();
	return (
		<label className="mb-4 flex cursor-pointer items-center gap-2">
			<span className="text-muted-foreground text-sm">{t("Monthly")}</span>
			<Switch checked={isAnnualToggle} onCheckedChange={setIsAnnualToggle} />
			<span className="text-muted-foreground text-sm">{t("Annual")}</span>
		</label>
	);
}
