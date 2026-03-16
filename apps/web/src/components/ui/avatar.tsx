import { Avatar as BaseAvatar } from "@base-ui/react/avatar";
import type { ComponentProps } from "react";

import { cn } from "@roasted/web/lib/cn";

function Avatar({
	className,
	size = "default",
	...props
}: BaseAvatar.Root.Props & {
	size?: "default" | "sm" | "lg";
}) {
	return (
		<BaseAvatar.Root
			data-slot="avatar"
			data-size={size}
			className={cn(
				"after:border-border group/avatar relative flex size-8 shrink-0 select-none overflow-hidden rounded after:absolute after:inset-0 after:border after:mix-blend-darken data-[size=lg]:size-12 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarImage({ className, ...props }: BaseAvatar.Image.Props) {
	return (
		<BaseAvatar.Image
			data-slot="avatar-image"
			className={cn("aspect-square size-full object-cover", className)}
			{...props}
		/>
	);
}

function AvatarFallback({ className, ...props }: BaseAvatar.Fallback.Props) {
	return (
		<BaseAvatar.Fallback
			data-slot="avatar-fallback"
			className={cn(
				"bg-muted flex size-full items-center justify-center text-sm group-data-[size=sm]/avatar:text-xs",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarBadge({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="avatar-badge"
			className={cn(
				"absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded bg-blend-color ring-2 select-none",
				"group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
				"group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
				"group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group"
			className={cn(
				"*:data-[slot=avatar]:ring-background group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2",
				className,
			)}
			{...props}
		/>
	);
}

function AvatarGroupCount({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="avatar-group-count"
			className={cn(
				"ring-background relative flex shrink-0 items-center justify-center ring-2",
				className,
			)}
			{...props}
		/>
	);
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge };
