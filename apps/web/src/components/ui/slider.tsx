import { Slider as BaseSlider } from "@base-ui/react/slider";
import { useMemo } from "react";

import { cn } from "@leuchtturm/web/lib/cn";

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	...props
}: BaseSlider.Root.Props) {
	const _values = Array.isArray(value)
		? value
		: Array.isArray(defaultValue)
			? defaultValue
			: [min, max];
	const thumbKeys = useMemo(
		() => Array.from({ length: _values.length }, () => crypto.randomUUID()),
		[_values.length],
	);

	return (
		<BaseSlider.Root
			className="data-horizontal:w-full data-vertical:h-full"
			data-slot="slider"
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			thumbAlignment="edge"
			{...props}
		>
			<BaseSlider.Control
				className={cn(
					"relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-44 data-vertical:w-auto data-vertical:flex-col",
					className,
				)}
			>
				<BaseSlider.Track
					data-slot="slider-track"
					className="bg-muted relative grow overflow-hidden rounded-full select-none data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
				>
					<BaseSlider.Indicator
						data-slot="slider-range"
						className="bg-primary absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
					/>
				</BaseSlider.Track>
				{thumbKeys.map((thumbKey) => (
					<BaseSlider.Thumb
						data-slot="slider-thumb"
						key={thumbKey}
						className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm select-none transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
					/>
				))}
			</BaseSlider.Control>
		</BaseSlider.Root>
	);
}

export { Slider };
