import { Separator as BaseSeparator } from "@base-ui/react/separator";

import { cn } from "@roasted/web/lib/cn";

function Separator({ className, orientation = "horizontal", ...props }: BaseSeparator.Props) {
	return (
		<BaseSeparator
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
