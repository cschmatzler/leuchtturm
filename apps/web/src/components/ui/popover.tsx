import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ComponentProps } from "react";

import { cn } from "@roasted/web/lib/cn";

function Popover({ ...props }: BasePopover.Root.Props) {
	return <BasePopover.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: BasePopover.Trigger.Props) {
	return <BasePopover.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
	className,
	align = "center",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	...props
}: BasePopover.Popup.Props &
	Pick<BasePopover.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<BasePopover.Portal>
			<BasePopover.Positioner
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
				className="isolate z-50"
			>
				<BasePopover.Popup
					data-slot="popover-content"
					className={cn(
						"bg-popover text-popover-foreground z-[60] w-72 origin-(--transform-origin) rounded border p-4 shadow-md outline-hidden",
						"data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
						"data-[side=bottom]:data-[starting-style]:translate-y-[-8px] data-[side=inline-end]:data-[starting-style]:translate-x-[8px] data-[side=inline-start]:data-[starting-style]:translate-x-[-8px] data-[side=left]:data-[starting-style]:translate-x-[8px] data-[side=right]:data-[starting-style]:translate-x-[-8px] data-[side=top]:data-[starting-style]:translate-y-[8px]",
						"transition-[opacity,transform] duration-150",
						className,
					)}
					{...props}
				/>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	);
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="popover-header"
			className={cn("flex items-center gap-2", className)}
			{...props}
		/>
	);
}

function PopoverTitle({ className, ...props }: BasePopover.Title.Props) {
	return (
		<BasePopover.Title
			data-slot="popover-title"
			className={cn("text-sm font-medium", className)}
			{...props}
		/>
	);
}

function PopoverDescription({ className, ...props }: BasePopover.Description.Props) {
	return (
		<BasePopover.Description
			data-slot="popover-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
