import { Menu as BaseMenu } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";

import { cn } from "@leuchtturm/web/lib/cn";

function Menu({ ...props }: BaseMenu.Root.Props) {
	return <BaseMenu.Root data-slot="menu" {...props} />;
}

function MenuPortal({ ...props }: BaseMenu.Portal.Props) {
	return <BaseMenu.Portal data-slot="menu-portal" {...props} />;
}

function MenuTrigger({ ...props }: BaseMenu.Trigger.Props) {
	return <BaseMenu.Trigger data-slot="menu-trigger" {...props} />;
}

function MenuContent({
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 4,
	className,
	...props
}: BaseMenu.Popup.Props &
	Pick<BaseMenu.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<BaseMenu.Portal>
			<BaseMenu.Positioner
				className="z-50"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<BaseMenu.Popup
					data-slot="menu-popup"
					className={cn(
						"bg-popover text-popover-foreground data-[open]:animate-in data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[open]:fade-in-0 data-[ending-style]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-[var(--available-height)] min-w-[8rem] origin-[var(--transform-origin)] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
						className,
					)}
					{...props}
				/>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);
}

function MenuGroup({ ...props }: BaseMenu.Group.Props) {
	return <BaseMenu.Group data-slot="menu-group" {...props} />;
}

function MenuLabel({
	className,
	inset,
	...props
}: BaseMenu.GroupLabel.Props & {
	inset?: boolean;
}) {
	return (
		<BaseMenu.GroupLabel
			data-slot="menu-group-label"
			data-inset={inset}
			className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
			{...props}
		/>
	);
}

function MenuItem({
	className,
	inset,
	variant = "default",
	...props
}: BaseMenu.Item.Props & {
	inset?: boolean;
	variant?: "default" | "destructive";
}) {
	return (
		<BaseMenu.Item
			data-slot="menu-item"
			data-inset={inset}
			data-variant={variant}
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:bg-destructive/10 dark:data-[variant=destructive]:data-[highlighted]:bg-destructive/20 data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function MenuSub({ ...props }: BaseMenu.SubmenuRoot.Props) {
	return <BaseMenu.SubmenuRoot data-slot="menu-sub" {...props} />;
}

function MenuSubTrigger({
	className,
	inset,
	children,
	...props
}: BaseMenu.SubmenuTrigger.Props & {
	inset?: boolean;
}) {
	return (
		<BaseMenu.SubmenuTrigger
			data-slot="menu-submenu-trigger"
			data-inset={inset}
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[popup-open]:bg-accent data-[popup-open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
				className,
			)}
			{...props}
		>
			{children}
			<ChevronRightIcon className="ml-auto size-4" />
		</BaseMenu.SubmenuTrigger>
	);
}

function MenuSubContent({
	align = "start",
	alignOffset = -4,
	side = "right",
	sideOffset = 0,
	className,
	...props
}: BaseMenu.Popup.Props &
	Pick<BaseMenu.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
	return (
		<BaseMenu.Portal>
			<BaseMenu.Positioner
				className="z-50"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<BaseMenu.Popup
					data-slot="menu-submenu-popup"
					className={cn(
						"bg-popover text-popover-foreground data-[open]:animate-in data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[open]:fade-in-0 data-[ending-style]:zoom-out-95 data-[open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-[var(--transform-origin)] overflow-hidden rounded-md border p-1 shadow-lg",
						className,
					)}
					{...props}
				/>
			</BaseMenu.Positioner>
		</BaseMenu.Portal>
	);
}

function MenuCheckboxItem({ className, children, checked, ...props }: BaseMenu.CheckboxItem.Props) {
	return (
		<BaseMenu.CheckboxItem
			data-slot="menu-checkbox-item"
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			checked={checked}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<BaseMenu.CheckboxItemIndicator>
					<CheckIcon className="size-4" />
				</BaseMenu.CheckboxItemIndicator>
			</span>
			{children}
		</BaseMenu.CheckboxItem>
	);
}

function MenuRadioGroup({ ...props }: BaseMenu.RadioGroup.Props) {
	return <BaseMenu.RadioGroup data-slot="menu-radio-group" {...props} />;
}

function MenuRadioItem({ className, children, ...props }: BaseMenu.RadioItem.Props) {
	return (
		<BaseMenu.RadioItem
			data-slot="menu-radio-item"
			className={cn(
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
				<BaseMenu.RadioItemIndicator>
					<CircleIcon className="size-2 fill-current" />
				</BaseMenu.RadioItemIndicator>
			</span>
			{children}
		</BaseMenu.RadioItem>
	);
}

function MenuSeparator({ className, ...props }: BaseMenu.Separator.Props) {
	return (
		<BaseMenu.Separator
			data-slot="menu-separator"
			className={cn("bg-border -mx-1 my-1 h-px", className)}
			{...props}
		/>
	);
}

function MenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="menu-shortcut"
			className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
			{...props}
		/>
	);
}

export {
	Menu,
	MenuPortal,
	MenuTrigger,
	MenuContent,
	MenuGroup,
	MenuLabel,
	MenuItem,
	MenuCheckboxItem,
	MenuRadioGroup,
	MenuRadioItem,
	MenuSeparator,
	MenuShortcut,
	MenuSub,
	MenuSubTrigger,
	MenuSubContent,
};
