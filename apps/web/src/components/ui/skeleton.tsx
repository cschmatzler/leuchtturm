import type { ComponentProps } from "react";

import { cn } from "@one/web/lib/cn";

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
