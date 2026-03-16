import { Dialog as BaseSheet } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@one/web/components/ui/button";
import { cn } from "@one/web/lib/cn";

function Sheet({ ...props }: BaseSheet.Root.Props) {
	return <BaseSheet.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: BaseSheet.Trigger.Props) {
	return <BaseSheet.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: BaseSheet.Close.Props) {
	return <BaseSheet.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: BaseSheet.Portal.Props) {
	return <BaseSheet.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: BaseSheet.Backdrop.Props) {
	return (
		<BaseSheet.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function SheetContent({
	className,
	children,
	side = "right",
	showCloseButton = true,
	...props
}: BaseSheet.Popup.Props & {
	side?: "top" | "right" | "bottom" | "left";
	showCloseButton?: boolean;
}) {
	return (
		<SheetPortal>
			<SheetOverlay />
			<BaseSheet.Popup
				data-slot="sheet-content"
				data-side={side}
				className={cn(
					"bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition-all duration-300 ease-in-out",
					side === "right" &&
						"inset-y-0 right-0 h-full w-3/4 translate-x-0 border-l data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full sm:max-w-sm",
					side === "left" &&
						"inset-y-0 left-0 h-full w-3/4 translate-x-0 border-r data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full sm:max-w-sm",
					side === "top" &&
						"inset-x-0 top-0 h-auto translate-y-0 border-b data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full",
					side === "bottom" &&
						"inset-x-0 bottom-0 h-auto translate-y-0 border-t data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<BaseSheet.Close
						data-slot="sheet-close"
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								className="absolute top-4 right-4 opacity-70 hover:opacity-100"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</BaseSheet.Close>
				)}
			</BaseSheet.Popup>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-header"
			className={cn("flex flex-col gap-1.5 p-4", className)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn("mt-auto flex flex-col gap-2 p-4", className)}
			{...props}
		/>
	);
}

function SheetTitle({ className, ...props }: BaseSheet.Title.Props) {
	return (
		<BaseSheet.Title
			data-slot="sheet-title"
			className={cn("text-foreground font-semibold", className)}
			{...props}
		/>
	);
}

function SheetDescription({ className, ...props }: BaseSheet.Description.Props) {
	return (
		<BaseSheet.Description
			data-slot="sheet-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
