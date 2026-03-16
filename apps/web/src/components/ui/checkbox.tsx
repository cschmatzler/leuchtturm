import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "@roasted/web/lib/cn";

function Checkbox({ className, ...props }: BaseCheckbox.Root.Props) {
	return (
		<BaseCheckbox.Root
			data-slot="checkbox"
			className={cn(
				"border-2 border-border dark:bg-input/30 data-[checked]:bg-primary data-[checked]:text-primary-foreground dark:data-[checked]:bg-primary data-[checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive peer relative size-5 shrink-0 rounded border shadow-xs outline-none transition-shadow after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		>
			<BaseCheckbox.Indicator
				data-slot="checkbox-indicator"
				className="grid place-content-center text-current transition-none"
			>
				<CheckIcon className="size-3.5" />
			</BaseCheckbox.Indicator>
		</BaseCheckbox.Root>
	);
}

export { Checkbox };
