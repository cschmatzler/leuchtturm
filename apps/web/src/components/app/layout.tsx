import type { ReactNode } from "react";

import { cn } from "@leuchtturm/web/lib/cn";

type ContentProps = {
	children?: ReactNode;
	className?: string;
};

export function Content({ children, className }: ContentProps) {
	return (
		<div className="flex grow justify-center bg-background">
			<div
				className={cn(
					"flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6",
					className,
				)}
			>
				{children}
			</div>
		</div>
	);
}
