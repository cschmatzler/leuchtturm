import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@one/web/components/ui/button";
import { cn } from "@one/web/lib/cn";

function Dialog({ ...props }: BaseDialog.Root.Props) {
	return <BaseDialog.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: BaseDialog.Trigger.Props) {
	return <BaseDialog.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: BaseDialog.Portal.Props) {
	return <BaseDialog.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: BaseDialog.Close.Props) {
	return <BaseDialog.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: BaseDialog.Backdrop.Props) {
	return (
		<BaseDialog.Backdrop
			data-slot="dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/50 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function DialogContent({
	className,
	children,
	showCloseButton = true,
	...props
}: BaseDialog.Popup.Props & {
	showCloseButton?: boolean;
}) {
	return (
		<DialogPortal>
			<DialogOverlay />
			<BaseDialog.Popup
				data-slot="dialog-content"
				className={cn(
					"bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded border p-6 shadow-lg outline-none transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:max-w-lg",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<BaseDialog.Close
						data-slot="dialog-close"
						render={
							<Button
								variant="ghost"
								size="icon-sm"
								className="absolute top-4 right-4 opacity-70 transition-opacity hover:opacity-100"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</BaseDialog.Close>
				)}
			</BaseDialog.Popup>
		</DialogPortal>
	);
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
			{...props}
		/>
	);
}

function DialogFooter({
	className,
	showCloseButton = false,
	children,
	...props
}: ComponentProps<"div"> & {
	showCloseButton?: boolean;
}) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
			{...props}
		>
			{children}
			{showCloseButton && (
				<BaseDialog.Close render={<Button variant="outline" />}>Close</BaseDialog.Close>
			)}
		</div>
	);
}

function DialogTitle({ className, ...props }: BaseDialog.Title.Props) {
	return (
		<BaseDialog.Title
			data-slot="dialog-title"
			className={cn("text-lg leading-none font-semibold", className)}
			{...props}
		/>
	);
}

function DialogDescription({ className, ...props }: BaseDialog.Description.Props) {
	return (
		<BaseDialog.Description
			data-slot="dialog-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
