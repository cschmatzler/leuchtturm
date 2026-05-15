import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { Match, Switch } from "@leuchtturm/web/components/ui/flow";

export function AuthLayoutShell({ children }: { readonly children: ReactNode }) {
	return <div className="grid min-h-svh w-full lg:grid-cols-2">{children}</div>;
}

export function AuthLayoutMain({ children }: { readonly children: ReactNode }) {
	return <div className="flex flex-col gap-4 p-6 md:p-10">{children}</div>;
}

export function AuthLayoutHeader({
	centered,
	children,
}: {
	readonly centered?: boolean;
	readonly children: ReactNode;
}) {
	return (
		<Switch>
			<Match when={centered}>
				<div className="flex justify-center gap-2 md:justify-start">{children}</div>
			</Match>
			<Match when={!centered}>
				<div className="flex items-center justify-between gap-3">{children}</div>
			</Match>
		</Switch>
	);
}

export function AuthLayoutBrand() {
	return (
		<Link
			to="/"
			className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
		>
			<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<SparkleIcon className="size-4" />
			</div>
			<span className="text-base font-semibold">Leuchtturm</span>
		</Link>
	);
}

export function AuthLayoutContent({ children }: { readonly children: ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="w-full max-w-md">{children}</div>
		</div>
	);
}

export function AuthLayoutAside() {
	return (
		<div className="relative hidden overflow-hidden bg-foreground text-background lg:block">
			<div className="pointer-events-none absolute inset-0" aria-hidden="true">
				<div className="animate-glow absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[100px]" />
				<div
					className="absolute inset-0 opacity-[0.035]"
					style={{
						backgroundImage:
							"linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
						backgroundSize: "64px 64px",
					}}
				/>
			</div>
			<div className="absolute inset-0 flex flex-col items-start justify-end p-10">
				<p className="font-serif text-2xl font-bold text-background/90">Focus, refined.</p>
				<p className="mt-2 max-w-xs text-sm leading-relaxed text-background/45">
					A fast, focused app built for people who value their time.
				</p>
			</div>
		</div>
	);
}
