import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import { cn } from "@chevrotain/web/lib/cn";

function Input({ className, type, ...props }: ComponentProps<"input">) {
	return (
		<BaseInput
			type={type}
			data-slot="input"
			className={cn(
				"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border border-border h-11 w-full min-w-0 rounded bg-background px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-primary focus-visible:ring-0 focus-visible:shadow-md",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			data-1p-ignore
			{...props}
		/>
	);
}

export { Input };
