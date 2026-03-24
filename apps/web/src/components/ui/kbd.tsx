import { ArrowBigUpIcon, OptionIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@chevrotain/web/lib/cn";

function Kbd({ className, ...props }: ComponentProps<"kbd">) {
	return (
		<kbd
			data-slot="kbd"
			className={cn(
				"bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none",
				"[&_svg:not([class*='size-'])]:size-3",
				"[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
				className,
			)}
			{...props}
		/>
	);
}

function KbdGroup({ className, ...props }: ComponentProps<"div">) {
	return (
		<kbd
			data-slot="kbd-group"
			className={cn("inline-flex items-center gap-1", className)}
			{...props}
		/>
	);
}

function getPlatformOptionKey(): ReactNode {
	return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? (
		<OptionIcon className="size-3" />
	) : (
		"Alt"
	);
}

function OptionShiftShortcut({ keyLabel }: { keyLabel: string }) {
	return (
		<KbdGroup>
			<Kbd>{getPlatformOptionKey()}</Kbd>
			<Kbd>
				<ArrowBigUpIcon className="size-3" />
			</Kbd>
			<Kbd>{keyLabel}</Kbd>
		</KbdGroup>
	);
}

function renderOptionShiftShortcut(key: string) {
	return <OptionShiftShortcut keyLabel={key} />;
}

export { Kbd, KbdGroup, OptionShiftShortcut, renderOptionShiftShortcut };
