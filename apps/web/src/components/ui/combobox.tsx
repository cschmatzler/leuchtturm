import { Popover as BasePopover } from "@base-ui/react/popover";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@one/web/lib/cn";

interface ComboboxRootProps extends BasePopover.Root.Props {
	children?: ReactNode;
}

function Combobox({ children, ...props }: ComboboxRootProps) {
	return (
		<BasePopover.Root data-slot="combobox" {...props}>
			{children}
		</BasePopover.Root>
	);
}

interface ComboboxTriggerProps extends Omit<BasePopover.Trigger.Props, "className" | "children"> {
	className?: string;
	children?: ReactNode;
	placeholder?: string;
}

function ComboboxTrigger({ className, children, placeholder, ...props }: ComboboxTriggerProps) {
	return (
		<BasePopover.Trigger
			data-slot="combobox-trigger"
			className={cn(
				"group/combobox border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			{children ?? (
				<span className="text-muted-foreground group-hover/combobox:text-inherit">
					{placeholder}
				</span>
			)}
			<ChevronsUpDownIcon className="size-4 shrink-0 opacity-50 pointer-events-none" />
		</BasePopover.Trigger>
	);
}

interface ComboboxContentProps
	extends
		Omit<BasePopover.Popup.Props, "className" | "children">,
		Pick<BasePopover.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> {
	className?: string;
	children?: ReactNode;
}

function ComboboxContent({
	className,
	children,
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	...props
}: ComboboxContentProps) {
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
					data-slot="combobox-content"
					className={cn(
						"bg-popover text-popover-foreground relative z-[60] w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-md border shadow-md outline-hidden",
						"data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
						"data-[side=bottom]:data-[starting-style]:translate-y-[-8px] data-[side=inline-end]:data-[starting-style]:translate-x-[8px] data-[side=inline-start]:data-[starting-style]:translate-x-[-8px] data-[side=left]:data-[starting-style]:translate-x-[8px] data-[side=right]:data-[starting-style]:translate-x-[-8px] data-[side=top]:data-[starting-style]:translate-y-[8px]",
						"transition-[opacity,transform] duration-150",
						className,
					)}
					{...props}
				>
					<CommandPrimitive
						data-slot="combobox-command"
						className="bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden"
					>
						{children}
					</CommandPrimitive>
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	);
}

function ComboboxInput({ className, ...props }: ComponentProps<typeof CommandPrimitive.Input>) {
	return (
		<div data-slot="combobox-input-wrapper" className="flex h-9 items-center gap-2 border-b px-3">
			<SearchIcon className="size-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				data-slot="combobox-input"
				className={cn(
					"placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
					className,
				)}
				{...props}
			/>
		</div>
	);
}

function ComboboxList({ className, ...props }: ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="combobox-list"
			className={cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className)}
			{...props}
		/>
	);
}

function ComboboxEmpty({ className, ...props }: ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="combobox-empty"
			className={cn("py-6 text-center text-sm", className)}
			{...props}
		/>
	);
}

function ComboboxGroup({ className, ...props }: ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="combobox-group"
			className={cn(
				"text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
				className,
			)}
			{...props}
		/>
	);
}

interface ComboboxItemProps extends ComponentProps<typeof CommandPrimitive.Item> {
	selected?: boolean;
}

function ComboboxItem({ className, children, selected, ...props }: ComboboxItemProps) {
	return (
		<CommandPrimitive.Item
			data-slot="combobox-item"
			className={cn(
				"data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
				className,
			)}
			{...props}
		>
			{children}
			<CheckIcon className={cn("ml-auto size-4", selected ? "opacity-100" : "opacity-0")} />
		</CommandPrimitive.Item>
	);
}

export {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
};
