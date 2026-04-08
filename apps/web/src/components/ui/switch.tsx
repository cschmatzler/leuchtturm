import { Switch as BaseSwitch } from "@base-ui/react/switch";

import { cn } from "@leuchtturm/web/lib/cn";

function Switch({
	className,
	size = "default",
	...props
}: BaseSwitch.Root.Props & {
	size?: "sm" | "default";
}) {
	return (
		<BaseSwitch.Root
			data-slot="switch"
			data-size={size}
			className={cn(
				"data-[checked]:bg-primary data-[unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[unchecked]:bg-input/80 peer group/switch relative inline-flex h-[1.5rem] w-10 shrink-0 items-center rounded border-2 border-border shadow-xs outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-[3px] data-disabled:cursor-not-allowed data-disabled:opacity-50",
				"hover:data-[checked]:bg-primary/90 hover:data-[unchecked]:bg-accent",
				className,
			)}
			{...props}
		>
			<BaseSwitch.Thumb
				data-slot="switch-thumb"
				className="bg-foreground dark:data-[unchecked]:bg-foreground dark:data-[checked]:bg-primary-foreground pointer-events-none block size-4 rounded ring-0 data-[checked]:translate-x-[calc(100%+4px)] data-[unchecked]:translate-x-1"
			/>
		</BaseSwitch.Root>
	);
}

export { Switch };
