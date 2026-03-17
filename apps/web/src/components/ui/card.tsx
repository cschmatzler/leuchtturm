import type { ComponentProps } from "react";

import { cn } from "@chevrotain/web/lib/cn";

function Card({
	className,
	size = "default",
	...props
}: ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			data-slot="card"
			data-size={size}
			className={cn(
				"bg-card text-card-foreground group/card flex flex-col gap-4 rounded border-2 border-border py-4 shadow-sm",
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header group/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn(
				"text-xl leading-none font-heading uppercase tracking-tight font-medium",
				className,
			)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("text-muted-foreground text-sm font-medium", className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="card-content" className={cn("px-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn("flex items-center px-4 [.border-t]:pt-4", className)}
			{...props}
		/>
	);
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
