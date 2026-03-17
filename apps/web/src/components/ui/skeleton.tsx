import type { ComponentProps } from "react";

import { cn } from "@chevrotain/web/lib/cn";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn("bg-accent animate-pulse rounded-md", className)}
			{...props}
		/>
	);
}

export { Skeleton };
