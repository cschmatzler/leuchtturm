import { Children, type ReactNode } from "react";

import { Separator } from "@roasted/web/components/ui/separator";
import { SidebarTrigger } from "@roasted/web/components/ui/sidebar";
import { cn } from "@roasted/web/lib/cn";

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
				"bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4",
				className,
			)}
		>
			<SidebarTrigger className="-ml-1" />
			<Separator orientation="vertical" className="mr-2 self-stretch" />
			<div className="flex min-w-0 flex-1 items-center justify-between gap-2">
				<div className="text-foreground min-w-0 font-extrabold truncate text-xl font-display italic text-primary">
					{titleChild}
				</div>
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
