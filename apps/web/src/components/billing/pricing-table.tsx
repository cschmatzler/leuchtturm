import { CheckIcon } from "@phosphor-icons/react/Check";
import { useCustomer, useListPlans } from "autumn-js/react";
import { T, useGT } from "gt-react";
import { useMemo, useState, type ComponentProps, type MouseEvent } from "react";

import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Switch } from "@leuchtturm/web/components/ui/switch";
import { reportError } from "@leuchtturm/web/lib/report-error";

type Plan = NonNullable<ReturnType<typeof useListPlans>["data"]>[number];
type PlanItem = Plan["items"][number];
type PricingButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
	onClick?: (event: MouseEvent<HTMLButtonElement>) => Promise<void> | void;
};

export function PricingTable() {
	const { data: customer, attach } = useCustomer({ errorOnNotFound: false });
	const { data: plans, isLoading, error } = useListPlans();

	const t = useGT();

	const [isAnnual, setIsAnnual] = useState(false);

	const intervals = useMemo(
		() => Array.from(new Set(plans?.map((plan) => plan.price?.interval).filter(Boolean))),
		[plans],
	);

	const hasMultipleIntervals = intervals.length > 1;
	const visiblePlans = useMemo(
		() =>
			plans?.filter((plan) => {
				if (!plan.price?.interval || !hasMultipleIntervals) return true;
				return plan.price.interval === (isAnnual ? "year" : "month");
			}) ?? [],
		[hasMultipleIntervals, isAnnual, plans],
	);

	if (isLoading) {
		return (
			<div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
				<T>Loading plans...</T>
			</div>
		);
	}

	if (error) {
		return (
			<p className="text-sm text-muted-foreground">
				<T>Could not load billing plans.</T>
			</p>
		);
	}

	if (visiblePlans.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				<T>No billing plans are available.</T>
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<Show when={hasMultipleIntervals}>
				<div className="flex items-center justify-center gap-2">
					<span className="text-sm text-muted-foreground">
						<T>Monthly</T>
					</span>
					<Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
					<span className="text-sm text-muted-foreground">
						<T>Annual</T>
					</span>
				</div>
			</Show>
			<ul className="divide-y divide-border border-y border-border">
				{visiblePlans.map((plan) => (
					<PricingPlan
						key={plan.id}
						plan={plan}
						buttonProps={{
							disabled:
								plan.customerEligibility?.status === "active" ||
								plan.customerEligibility?.status === "scheduled",
							onClick: async () => {
								if (!customer) throw new Error("Missing billing customer.");

								await attach({ planId: plan.id });
							},
						}}
						onError={(error) =>
							reportError(error, t("Could not open checkout."), { source: "billing-settings" })
						}
					/>
				))}
			</ul>
		</div>
	);
}

function PricingPlan({
	plan,
	buttonProps,
	onError,
}: {
	readonly plan: Plan;
	readonly buttonProps?: PricingButtonProps;
	readonly onError: (error: unknown) => void;
}) {
	const t = useGT();

	const [isLoading, setIsLoading] = useState(false);

	const isRecommended = plan.customerEligibility?.attachAction === "upgrade";
	const mainPriceDisplay = plan.price?.display ?? { primaryText: t("Free") };
	const featureItems = plan.price ? plan.items : plan.items.slice(1);

	async function handleClick(event: MouseEvent<HTMLButtonElement>) {
		setIsLoading(true);
		try {
			await buttonProps?.onClick?.(event);
		} catch (error) {
			onError(error);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<li className="py-5">
			<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-4">
					<div className="space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="text-sm font-medium">{plan.name}</h3>
							<Show when={isRecommended}>
								<Badge variant="secondary">
									<T>Recommended</T>
								</Badge>
							</Show>
						</div>
						<Show when={plan.description}>
							{(description) => <p className="text-sm text-muted-foreground">{description}</p>}
						</Show>
					</div>
					<PricingFeatureList items={featureItems} />
				</div>
				<div className="flex shrink-0 flex-col gap-3 sm:items-end">
					<div className="flex items-baseline gap-1 sm:justify-end">
						<span className="text-3xl font-semibold">{mainPriceDisplay.primaryText}</span>
						<Show when={mainPriceDisplay.secondaryText}>
							{(text) => <span className="text-sm text-muted-foreground">{text}</span>}
						</Show>
					</div>
					<Button
						variant={isRecommended ? "default" : "secondary"}
						{...buttonProps}
						onClick={handleClick}
						loading={isLoading}
					>
						{getButtonText(plan, t)}
					</Button>
				</div>
			</div>
		</li>
	);
}

function PricingFeatureList({ items }: { readonly items: PlanItem[] }) {
	if (items.length === 0) return null;

	return (
		<ul className="space-y-2.5">
			{items.map((item, index) => (
				<li key={item.featureId ?? index} className="flex items-start gap-2.5 text-sm">
					<CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
					<div className="flex flex-col">
						<span>{item.display?.primaryText ?? item.feature?.name ?? item.featureId}</span>
						<Show when={item.display?.secondaryText}>
							{(text) => <span className="text-sm text-muted-foreground">{text}</span>}
						</Show>
					</div>
				</li>
			))}
		</ul>
	);
}

function getButtonText(plan: Plan, t: (key: string) => string) {
	if (plan.freeTrial) return t("Start free trial");

	switch (plan.customerEligibility?.attachAction) {
		case "none":
			return t("Current plan");
		case "upgrade":
			return t("Upgrade");
		case "downgrade":
			return t("Downgrade");
		case "purchase":
			return t("Purchase");
		default:
			return t("Get started");
	}
}
