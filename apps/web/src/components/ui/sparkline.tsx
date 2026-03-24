import { ChartContainer, type ChartConfig } from "@chevrotain/web/components/ui/chart";
import { RechartsBoundary, useRechartsModule } from "@chevrotain/web/components/ui/recharts";
import { cn } from "@chevrotain/web/lib/cn";

type SparklineProps = {
	data: { value: number | null }[];
	label?: string;
	color?: string;
	height?: number;
	width?: number;
	showDots?: boolean;
	className?: string;
};

export function Sparkline(props: SparklineProps) {
	return (
		<RechartsBoundary fallback={null}>
			<SparklineContent {...props} />
		</RechartsBoundary>
	);
}

function SparklineContent({
	data,
	label,
	color = "var(--color-chart-1)",
	height = 40,
	width = 120,
	showDots,
	className,
}: SparklineProps) {
	const { Line, LineChart } = useRechartsModule();
	const lastValue = data.findLast((d) => d.value !== null)?.value;
	const shouldShowDots = showDots ?? data.length <= 10;

	const config = {
		value: {
			label: label ?? "Value",
			color: color,
		},
	} satisfies ChartConfig;

	return (
		<div
			role="img"
			aria-label={label ?? "Sparkline chart"}
			className={cn("flex flex-col gap-1", className)}
		>
			<div className="flex items-baseline justify-between gap-2">
				{label && <span className="text-muted-foreground text-xs font-medium">{label}</span>}
				{lastValue != null && (
					<span className="font-mono text-xs font-medium tabular-nums">
						{lastValue.toLocaleString()}
					</span>
				)}
			</div>
			<ChartContainer config={config} className="aspect-auto" style={{ height, width }}>
				<LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
					<Line
						type="monotone"
						dataKey="value"
						stroke="var(--color-value)"
						strokeWidth={2}
						dot={shouldShowDots ? { r: 2, fill: "var(--color-value)", strokeWidth: 0 } : false}
						activeDot={{ r: 4, fill: "var(--color-value)", strokeWidth: 0 }}
						isAnimationActive={false}
						connectNulls={false}
					/>
				</LineChart>
			</ChartContainer>
		</div>
	);
}
