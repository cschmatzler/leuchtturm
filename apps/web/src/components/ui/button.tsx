import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@roasted/web/lib/cn";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-heading uppercase tracking-wide transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive group/button select-none border-2 border-transparent active:translate-y-0.5 active:shadow-none",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground border-border hover:bg-primary/90 shadow-sm hover:shadow-md hover:-translate-y-0.5",
				destructive:
					"bg-destructive text-white border-destructive hover:bg-destructive/90 shadow-sm",
				outline:
					"border-border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground hover:shadow-md hover:-translate-y-0.5",
				secondary:
					"bg-secondary text-secondary-foreground border-border shadow-sm hover:bg-secondary/80 hover:shadow-md hover:-translate-y-0.5",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-11 px-6 py-2 has-[>svg]:px-4 text-base",
				xs: "h-8 rounded gap-1 px-3 has-[>svg]:px-2 text-xs border",
				sm: "h-9 rounded gap-1.5 px-4 has-[>svg]:px-2.5 text-sm",
				lg: "h-14 rounded px-8 has-[>svg]:px-6 text-lg",
				icon: "size-11",
				"icon-xs": "size-8",
				"icon-sm": "size-9",
				"icon-lg": "size-14",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	render,
	...props
}: useRender.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
	return useRender({
		defaultTagName: "button",
		render,
		props: {
			"data-slot": "button",
			className: cn(buttonVariants({ variant, size, className })),
			...props,
		},
	});
}

export { Button, buttonVariants };
