import { type ReactNode } from "react";

import { MarketingHeader } from "@leuchtturm/web/components/app/marketing-header";

export function LegalPage(props: {
	readonly title: string;
	readonly description: ReactNode;
	readonly children: ReactNode;
}) {
	return (
		<div className="flex min-h-svh w-full flex-col bg-background">
			<MarketingHeader />
			<main className="flex flex-1 justify-center px-6 py-16 md:py-24">
				<article className="flex w-full max-w-2xl flex-col gap-10">
					<header className="flex flex-col gap-3 border-b border-border pb-8">
						<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
							Legal
						</p>
						<h1 className="text-3xl font-bold tracking-tight">{props.title}</h1>
						<p className="text-sm text-muted-foreground">Last updated: Jan 24, 2026</p>
						<p className="mt-1 leading-relaxed text-muted-foreground">{props.description}</p>
					</header>
					{props.children}
				</article>
			</main>
		</div>
	);
}

export function LegalSection(props: { readonly title: string; readonly children: ReactNode }) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-xl font-semibold">{props.title}</h2>
			<p className="leading-relaxed text-muted-foreground">{props.children}</p>
		</section>
	);
}
