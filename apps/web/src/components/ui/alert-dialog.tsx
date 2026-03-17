import { AlertDialog as BaseAlertDialog } from "@base-ui/react/alert-dialog";
import type { ComponentProps } from "react";

import { Button, buttonVariants } from "@chevrotain/web/components/ui/button";
import { cn } from "@chevrotain/web/lib/cn";

function AlertDialog({ ...props }: BaseAlertDialog.Root.Props) {
	return <BaseAlertDialog.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: BaseAlertDialog.Trigger.Props) {
	return <BaseAlertDialog.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: BaseAlertDialog.Portal.Props) {
	return <BaseAlertDialog.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: BaseAlertDialog.Backdrop.Props) {
	return (
		<BaseAlertDialog.Backdrop
			data-slot="alert-dialog-overlay"
			className={cn(
				"fixed inset-0 isolate z-50 bg-black/50 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogContent({
	className,
	size = "default",
	...props
}: BaseAlertDialog.Popup.Props & {
	size?: "default" | "sm";
}) {
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<BaseAlertDialog.Popup
				data-slot="alert-dialog-content"
				data-size={size}
				className={cn(
					"group/alert-dialog-content bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded border p-6 shadow-lg outline-none transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 sm:max-w-lg",
					className,
				)}
				{...props}
			/>
		</AlertDialogPortal>
	);
}

function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
			{...props}
		/>
	);
}

function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn(
				"flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	);
}

function AlertDialogMedia({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="alert-dialog-media" className={cn(className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }: BaseAlertDialog.Title.Props) {
	return (
		<BaseAlertDialog.Title
			data-slot="alert-dialog-title"
			className={cn("text-lg font-semibold", className)}
			{...props}
		/>
	);
}

function AlertDialogDescription({ className, ...props }: BaseAlertDialog.Description.Props) {
	return (
		<BaseAlertDialog.Description
			data-slot="alert-dialog-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function AlertDialogAction({ className, ...props }: ComponentProps<typeof Button>) {
	return <Button data-slot="alert-dialog-action" className={cn(className)} {...props} />;
}

function AlertDialogCancel({
	className,
	variant = "outline",
	size = "default",
	...props
}: BaseAlertDialog.Close.Props & Pick<ComponentProps<typeof Button>, "variant" | "size">) {
	return (
		<BaseAlertDialog.Close
			data-slot="alert-dialog-cancel"
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
};
