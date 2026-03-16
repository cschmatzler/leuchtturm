import type { ComponentProps } from "react";

import { cn } from "@one/web/lib/cn";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border border-border min-h-20 w-full min-w-0 rounded bg-background px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-md",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
