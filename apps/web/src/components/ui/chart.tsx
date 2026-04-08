import type { ComponentProps, ComponentType, CSSProperties, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import type { Props as DefaultLegendContentProps } from "recharts/types/component/DefaultLegendContent";
import type {
	NameType,
	Payload,
	Props as DefaultTooltipContentProps,
	ValueType,
} from "recharts/types/component/DefaultTooltipContent";

import {
	RechartsBoundary,
	type RechartsModule,
	useRechartsModule,
} from "@leuchtturm/web/components/ui/recharts";
import { cn } from "@leuchtturm/web/lib/cn";

const THEMES = { light: "", dark: ".dark" } as const;

type ResponsiveContainerProps = ComponentProps<RechartsModule["ResponsiveContainer"]>;
type TooltipProps = ComponentProps<RechartsModule["Tooltip"]>;
type LegendProps = ComponentProps<RechartsModule["Legend"]>;
type TooltipPayloadItem = Payload<ValueType, NameType>;

export type ChartConfig = Record<
	string,
	{
		label?: ReactNode;
		icon?: ComponentType;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<keyof typeof THEMES, string> }
	)
>;

interface ChartContextProps {
	config: ChartConfig;
}

const ChartContext = createContext<ChartContextProps | null>(null);

function useChart() {
	const context = useContext(ChartContext);

	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}

	return context;
}

interface ChartContainerProps
	extends
		Omit<ComponentProps<"div">, "children">,
		Pick<
			ResponsiveContainerProps,
			| "initialDimension"
			| "aspect"
			| "debounce"
			| "minHeight"
			| "minWidth"
			| "maxHeight"
			| "height"
			| "width"
			| "onResize"
			| "children"
		> {
	config: ChartConfig;
}

function ChartContainer({
	id,
	config,
	initialDimension = { width: 320, height: 200 },
	className,
	children,
	aspect,
	debounce,
	minHeight,
	minWidth,
	maxHeight,
	height,
	width,
	onResize,
	...props
}: ChartContainerProps) {
	const uniqueId = useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				data-slot="chart"
				data-chart={chartId}
				className={cn(
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
					className,
				)}
				{...props}
			>
				<ChartStyle id={chartId} config={config} />
				<RechartsBoundary fallback={null}>
					<ChartResponsiveContainer
						initialDimension={initialDimension}
						aspect={aspect}
						debounce={debounce}
						minHeight={minHeight}
						minWidth={minWidth}
						maxHeight={maxHeight}
						height={height}
						width={width}
						onResize={onResize}
					>
						{children}
					</ChartResponsiveContainer>
				</RechartsBoundary>
			</div>
		</ChartContext.Provider>
	);
}

function ChartResponsiveContainer(props: ResponsiveContainerProps) {
	const { ResponsiveContainer } = useRechartsModule();

	return <ResponsiveContainer {...props} />;
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const colorConfig = Object.entries(config).filter(
		([, configuration]) => configuration.theme ?? configuration.color,
	);

	if (!colorConfig.length) {
		return null;
	}

	const css = Object.entries(THEMES)
		.map(
			([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
	.map(([key, itemConfig]) => {
		const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
		return color ? `  --color-${key}: ${color};` : null;
	})
	.join("\n")}
}
`,
		)
		.join("\n");

	return <style>{css}</style>;
}

function ChartTooltip(props: TooltipProps) {
	const { Tooltip } = useRechartsModule();

	return (
		<Tooltip
			wrapperStyle={{ outline: "none" }}
			cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
			isAnimationActive={false}
			{...props}
		/>
	);
}

function ChartTooltipContent({
	active,
	payload,
	className,
	indicator = "dot",
	hideLabel = false,
	hideIndicator = false,
	label,
	labelFormatter,
	labelClassName,
	formatter,
	color,
	nameKey,
	labelKey,
}: TooltipProps &
	ComponentProps<"div"> & {
		hideLabel?: boolean;
		hideIndicator?: boolean;
		indicator?: "line" | "dot" | "dashed";
		nameKey?: string;
		labelKey?: string;
	} & Omit<DefaultTooltipContentProps<ValueType, NameType>, "accessibilityLayer">) {
	const { config } = useChart();

	let tooltipLabel: ReactNode = null;
	if (!hideLabel && payload?.length) {
		const [item] = payload;
		const key = String(labelKey ?? item?.dataKey ?? item?.name ?? "value");
		const itemConfig = getPayloadConfigFromPayload(config, item, key);
		const value =
			!labelKey && typeof label === "string" ? (config[label]?.label ?? label) : itemConfig?.label;

		if (labelFormatter) {
			tooltipLabel = (
				<div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>
			);
		} else if (value) {
			tooltipLabel = <div className={cn("font-medium", labelClassName)}>{value}</div>;
		}
	}

	if (!active || !payload?.length) {
		return null;
	}

	const nestLabel = payload.length === 1 && indicator !== "dot";

	return (
		<div
			className={cn(
				"border-border/50 bg-popover text-popover-foreground grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
				className,
			)}
		>
			{!nestLabel ? tooltipLabel : null}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => {
						const key = String(nameKey ?? item.name ?? item.dataKey ?? "value");
						const itemConfig = getPayloadConfigFromPayload(config, item, key);
						const indicatorColor = color ?? item.payload?.fill ?? item.color;
						const itemIndex = payload.indexOf(item);

						return (
							<div
								key={getTooltipItemKey(item)}
								className={cn(
									"[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
									indicator === "dot" && "items-center",
								)}
							>
								{formatter && item?.value !== undefined && item.name ? (
									formatter(item.value, item.name, item, itemIndex, item.payload)
								) : (
									<>
										{itemConfig?.icon ? (
											<itemConfig.icon />
										) : (
											!hideIndicator && (
												<div
													className={cn(
														"shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
														{
															"h-2.5 w-2.5": indicator === "dot",
															"w-1": indicator === "line",
															"w-0 border-[1.5px] border-dashed bg-transparent":
																indicator === "dashed",
															"my-0.5": nestLabel && indicator === "dashed",
														},
													)}
													style={
														{
															"--color-bg": indicatorColor,
															"--color-border": indicatorColor,
														} as CSSProperties
													}
												/>
											)
										)}
										<div
											className={cn(
												"flex flex-1 justify-between leading-none",
												nestLabel ? "items-end" : "items-center",
											)}
										>
											<div className="grid gap-1.5">
												{nestLabel ? tooltipLabel : null}
												<span className="text-muted-foreground">
													{itemConfig?.label ?? item.name}
												</span>
											</div>
											{item.value != null && (
												<span className="text-foreground font-mono font-medium tabular-nums">
													{typeof item.value === "number"
														? item.value.toLocaleString()
														: String(item.value)}
												</span>
											)}
										</div>
									</>
								)}
							</div>
						);
					})}
			</div>
		</div>
	);
}

function ChartLegend(props: LegendProps) {
	const { Legend } = useRechartsModule();

	return <Legend {...props} />;
}

function ChartLegendContent({
	className,
	hideIcon = false,
	nameKey,
	payload,
	verticalAlign,
}: ComponentProps<"div"> & {
	hideIcon?: boolean;
	nameKey?: string;
} & DefaultLegendContentProps) {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div
			className={cn(
				"flex items-center justify-center gap-4",
				verticalAlign === "top" ? "pb-3" : "pt-3",
				className,
			)}
		>
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const key = String(nameKey ?? item.dataKey ?? "value");
					const itemConfig = getPayloadConfigFromPayload(config, item, key);

					return (
						<div
							key={item.value}
							className={cn(
								"[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
							)}
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className="h-2 w-2 shrink-0 rounded-[2px]"
									style={{
										backgroundColor: item.color,
									}}
								/>
							)}
							{itemConfig?.label}
						</div>
					);
				})}
		</div>
	);
}

function getTooltipItemKey(item: TooltipPayloadItem) {
	const key = [item.dataKey, item.name, item.value, item.color, item.payload?.fill]
		.filter((value) => value != null && value !== "")
		.map((value) => String(value))
		.join("-");

	return key || JSON.stringify(item.payload ?? {});
}

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string) {
	if (typeof payload !== "object" || payload === null) {
		return undefined;
	}

	const payloadPayload =
		"payload" in payload && typeof payload.payload === "object" && payload.payload !== null
			? payload.payload
			: undefined;

	let configLabelKey: string = key;

	if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
		configLabelKey = payload[key as keyof typeof payload] as string;
	} else if (
		payloadPayload &&
		key in payloadPayload &&
		typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
	) {
		configLabelKey = payloadPayload[key as keyof typeof payloadPayload] as string;
	}

	return configLabelKey in config ? config[configLabelKey] : config[key];
}

export {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartStyle,
	ChartTooltip,
	ChartTooltipContent,
};
