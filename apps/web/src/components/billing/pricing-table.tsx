import { CheckIcon } from "@phosphor-icons/react/Check";
import type { Product, ProductItem } from "autumn-js";
import { CheckoutDialog, useCustomer, usePricingTable, type ProductDetails } from "autumn-js/react";
import { T, useGT } from "gt-react";
import { useMemo, useState, type ComponentProps, type MouseEvent } from "react";

import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Switch } from "@leuchtturm/web/components/ui/switch";
import { reportError } from "@leuchtturm/web/lib/report-error";
import { cn } from "@leuchtturm/web/lib/utils";

type PricingButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
	onClick?: (event: MouseEvent<HTMLButtonElement>) => Promise<void> | void;
};

export function PricingTable({ productDetails }: { readonly productDetails?: ProductDetails[] }) {
	const { customer, checkout } = useCustomer({ errorOnNotFound: false });
	const { products, isLoading, error } = usePricingTable({ productDetails });

	const t = useGT();

	const [isAnnual, setIsAnnual] = useState(false);

	const intervals = useMemo(
		() =>
			Array.from(
				new Set(products?.map((product) => product.properties?.interval_group).filter(Boolean)),
			),
		[products],
	);

	const hasMultipleIntervals = intervals.length > 1;
	const visibleProducts = useMemo(
		() =>
			products?.filter((product) => {
				if (!product.properties?.interval_group || !hasMultipleIntervals) return true;
				return product.properties.interval_group === (isAnnual ? "year" : "month");
			}) ?? [],
		[hasMultipleIntervals, isAnnual, products],
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

	if (visibleProducts.length === 0) {
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
			<div className="grid gap-3 sm:grid-cols-2">
				{visibleProducts.map((product) => (
					<PricingCard
						key={product.id}
						product={product}
						buttonProps={{
							disabled:
								(product.scenario === "active" && !product.properties.updateable) ||
								product.scenario === "scheduled",
							onClick: async () => {
								if (product.id && customer) {
									const { error } = await checkout({
										productId: product.id,
										dialog: CheckoutDialog,
									});
									if (error) throw error;
									return;
								}

								if (product.display?.button_url) {
									window.open(product.display.button_url, "_blank");
									return;
								}

								throw new Error("Missing billing customer.");
							},
						}}
						onError={(error) =>
							reportError(error, t("Could not open checkout."), { source: "billing-settings" })
						}
					/>
				))}
			</div>
		</div>
	);
}

function PricingCard({
	product,
	buttonProps,
	onError,
}: {
	readonly product: Product;
	readonly buttonProps?: PricingButtonProps;
	readonly onError: (error: unknown) => void;
}) {
	const t = useGT();

	const [isLoading, setIsLoading] = useState(false);

	const productDisplay = product.display;
	const isRecommended = Boolean(productDisplay?.recommend_text);
	const mainPriceDisplay = product.properties?.is_free
		? { primary_text: t("Free") }
		: product.items[0]?.display;
	const featureItems = product.properties?.is_free ? product.items : product.items.slice(1);

	const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
		setIsLoading(true);
		try {
			await buttonProps?.onClick?.(event);
		} catch (error) {
			onError(error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Card className={cn("relative h-full", isRecommended && "ring-primary ring-2")}>
			<Show when={productDisplay?.recommend_text}>
				{(text) => (
					<Badge className="absolute top-4 right-4" variant="secondary">
						{text}
					</Badge>
				)}
			</Show>
			<CardHeader>
				<CardTitle>{productDisplay?.name || product.name}</CardTitle>
				<Show when={productDisplay?.description}>
					{(description) => (
						<p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
					)}
				</Show>
			</CardHeader>
			<CardContent className="flex grow flex-col gap-6">
				<div className="flex items-baseline gap-1">
					<span className="text-3xl font-semibold">{mainPriceDisplay?.primary_text}</span>
					<Show when={mainPriceDisplay?.secondary_text}>
						{(text) => <span className="text-sm text-muted-foreground">{text}</span>}
					</Show>
				</div>
				<PricingFeatureList items={featureItems} />
			</CardContent>
			<CardFooter>
				<Button
					className="w-full"
					variant={isRecommended ? "default" : "secondary"}
					{...buttonProps}
					onClick={handleClick}
					loading={isLoading}
				>
					{productDisplay?.button_text || getButtonText(product, t)}
				</Button>
			</CardFooter>
		</Card>
	);
}

function PricingFeatureList({ items }: { readonly items: ProductItem[] }) {
	if (items.length === 0) return null;

	return (
		<ul className="space-y-2.5">
			{items.map((item, index) => (
				<li key={item.feature_id ?? index} className="flex items-start gap-2.5 text-sm">
					<CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
					<div className="flex flex-col">
						<span>{item.display?.primary_text}</span>
						<Show when={item.display?.secondary_text}>
							{(text) => <span className="text-sm text-muted-foreground">{text}</span>}
						</Show>
					</div>
				</li>
			))}
		</ul>
	);
}

function getButtonText(product: Product, t: (key: string) => string) {
	if (product.properties.has_trial) return t("Start free trial");

	switch (product.scenario) {
		case "scheduled":
			return t("Plan scheduled");
		case "active":
			return product.properties.updateable ? t("Update plan") : t("Current plan");
		case "renew":
			return t("Renew");
		case "upgrade":
			return t("Upgrade");
		case "downgrade":
			return t("Downgrade");
		case "cancel":
			return t("Cancel plan");
		default:
			return product.properties.is_one_off ? t("Purchase") : t("Get started");
	}
}
