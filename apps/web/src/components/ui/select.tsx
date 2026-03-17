import { Select as BaseSelect } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@chevrotain/web/lib/cn";

const Select = BaseSelect.Root;

function SelectGroup({ className, ...props }: BaseSelect.Group.Props) {
	return <BaseSelect.Group data-slot="select-group" className={cn(className)} {...props} />;
}

function SelectValue({ className, ...props }: BaseSelect.Value.Props) {
	return <BaseSelect.Value data-slot="select-value" className={cn(className)} {...props} />;
}

function SelectTrigger({
	className,
	size = "default",
	children,
	...props
}: BaseSelect.Trigger.Props & {
	size?: "sm" | "default";
}) {
	return (
		<BaseSelect.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				"border border-border data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-md aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded bg-background px-3 py-1 text-base md:text-sm whitespace-nowrap shadow-xs outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-11 data-[size=sm]:h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{children}
			<BaseSelect.Icon
				render={<ChevronDownIcon className="size-4 opacity-50 pointer-events-none" />}
			/>
		</BaseSelect.Trigger>
	);
}

function SelectContent({
	className,
	children,
	side = "bottom",
	sideOffset = 4,
	align = "center",
	alignOffset = 0,
	alignItemWithTrigger = true,
	...props
}: BaseSelect.Popup.Props &
	Pick<
		BaseSelect.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
	>) {
	return (
		<BaseSelect.Portal>
			<BaseSelect.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				alignItemWithTrigger={alignItemWithTrigger}
				className="isolate z-50"
			>
				<BaseSelect.Popup
					data-slot="select-content"
					data-align-trigger={alignItemWithTrigger}
					className={cn(
						"bg-popover text-popover-foreground relative isolate z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded border p-1 shadow-md data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[align-trigger=true]:animate-none",
						className,
					)}
					{...props}
				>
					<SelectScrollUpButton />
					<BaseSelect.List>{children}</BaseSelect.List>
					<SelectScrollDownButton />
				</BaseSelect.Popup>
			</BaseSelect.Positioner>
		</BaseSelect.Portal>
	);
}

function SelectLabel({ className, ...props }: BaseSelect.GroupLabel.Props) {
	return (
		<BaseSelect.GroupLabel
			data-slot="select-label"
			className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
			{...props}
		/>
	);
}

function SelectItem({ className, children, ...props }: BaseSelect.Item.Props) {
	return (
		<BaseSelect.Item
			data-slot="select-item"
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<BaseSelect.ItemText className="shrink-0 whitespace-nowrap">{children}</BaseSelect.ItemText>
			<BaseSelect.ItemIndicator
				render={<span className="absolute right-2 flex size-3.5 items-center justify-center" />}
			>
				<CheckIcon className="size-4 pointer-events-none" />
			</BaseSelect.ItemIndicator>
		</BaseSelect.Item>
	);
}

function SelectSeparator({ className, ...props }: BaseSelect.Separator.Props) {
	return (
		<BaseSelect.Separator
			data-slot="select-separator"
			className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
			{...props}
		/>
	);
}

function SelectScrollUpButton({
	className,
	...props
}: ComponentProps<typeof BaseSelect.ScrollUpArrow>) {
	return (
		<BaseSelect.ScrollUpArrow
			data-slot="select-scroll-up-button"
			className={cn("flex cursor-default items-center justify-center py-1 top-0 w-full", className)}
			{...props}
		>
			<ChevronUpIcon className="size-4" />
		</BaseSelect.ScrollUpArrow>
	);
}

function SelectScrollDownButton({
	className,
	...props
}: ComponentProps<typeof BaseSelect.ScrollDownArrow>) {
	return (
		<BaseSelect.ScrollDownArrow
			data-slot="select-scroll-down-button"
			className={cn(
				"flex cursor-default items-center justify-center py-1 bottom-0 w-full",
				className,
			)}
			{...props}
		>
			<ChevronDownIcon className="size-4" />
		</BaseSelect.ScrollDownArrow>
	);
}

export {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
};
