import { Children, type ReactNode } from "react";

import { Separator } from "@leuchtturm/web/components/ui/separator";
import { SidebarTrigger } from "@leuchtturm/web/components/ui/sidebar";
import { cn } from "@leuchtturm/web/lib/cn";

type HeaderProps = {
	children?: ReactNode;
	className?: string;
};

type ContentProps = {
	children?: ReactNode;
	className?: string;
};

export function Header({ children, className }: HeaderProps) {
	const childArray = Children.toArray(children).filter(Boolean);
	const [titleChild, ...actionChildren] = childArray;

	return (
		<header
			className={cn(
				"bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 backdrop-blur-md",
				className,
			)}
		>
			<SidebarTrigger className="-ml-1 md:hidden" />
			<Separator orientation="vertical" className="mr-2 self-stretch md:hidden" />
			<div className="flex min-w-0 flex-1 items-center justify-between gap-2">
				<div className="min-w-0 truncate text-base font-semibold">{titleChild}</div>
				{actionChildren.length > 0 && (
					<div className="flex shrink-0 items-center gap-2">{actionChildren}</div>
				)}
			</div>
		</header>
	);
}

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
