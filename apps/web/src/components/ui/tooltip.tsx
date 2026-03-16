import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";

import { cn } from "@roasted/web/lib/cn";

function TooltipProvider({ delay = 0, ...props }: BaseTooltip.Provider.Props) {
	return <BaseTooltip.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({ ...props }: BaseTooltip.Root.Props) {
	return (
		<TooltipProvider>
			<BaseTooltip.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	);
}

function TooltipTrigger({ ...props }: BaseTooltip.Trigger.Props) {
	return <BaseTooltip.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
	className,
	side = "top",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	children,
	...props
}: BaseTooltip.Popup.Props &
	Pick<BaseTooltip.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<BaseTooltip.Portal>
			<BaseTooltip.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-50"
			>
				<BaseTooltip.Popup
					data-slot="tooltip-content"
					className={cn(
						"bg-foreground text-background z-50 w-fit max-w-xs origin-(--transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
						"data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
						"data-[side=bottom]:data-[starting-style]:translate-y-[-8px] data-[side=inline-end]:data-[starting-style]:translate-x-[8px] data-[side=inline-start]:data-[starting-style]:translate-x-[-8px] data-[side=left]:data-[starting-style]:translate-x-[8px] data-[side=right]:data-[starting-style]:translate-x-[-8px] data-[side=top]:data-[starting-style]:translate-y-[8px]",
						"transition-[opacity,transform] duration-150",
						className,
					)}
					{...props}
				>
					{children}
					<BaseTooltip.Arrow className="bg-foreground fill-foreground z-50 data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
				</BaseTooltip.Popup>
			</BaseTooltip.Positioner>
		</BaseTooltip.Portal>
	);
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
