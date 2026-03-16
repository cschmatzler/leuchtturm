import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@one/web/lib/cn";

function Tabs({ className, orientation = "horizontal", ...props }: BaseTabs.Root.Props) {
	return (
		<BaseTabs.Root
			data-slot="tabs"
			data-orientation={orientation}
			className={cn("group/tabs flex data-[orientation=horizontal]:flex-col", className)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"text-muted-foreground group/tabs-list inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
	{
		variants: {
			variant: {
				default: "bg-muted h-9 rounded p-[3px]",
				line: "gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function TabsList({
	className,
	variant = "default",
	...props
}: BaseTabs.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<BaseTabs.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: BaseTabs.Tab.Props) {
	return (
		<BaseTabs.Tab
			data-slot="tabs-trigger"
			className={cn(
				"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded border border-transparent px-2 py-1 text-sm font-medium transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				"group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
				"data-active:bg-background dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 data-active:text-foreground data-active:shadow-sm",
				"after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				"group-data-[variant=default]/tabs-list:active:scale-[0.97]",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: BaseTabs.Panel.Props) {
	return (
		<BaseTabs.Panel
			data-slot="tabs-content"
			className={cn("flex-1 outline-none", className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
