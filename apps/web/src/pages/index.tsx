import { createFileRoute, Link } from "@tanstack/react-router";
import { InboxIcon, MessageSquareIcon, SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MarketingHeader } from "@chevrotain/web/components/app/marketing-header";
import { Badge } from "@chevrotain/web/components/ui/badge";
import { Button } from "@chevrotain/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@chevrotain/web/components/ui/card";
import { useReactQuery } from "@chevrotain/web/lib/query";
import { sessionQuery } from "@chevrotain/web/queries/session";

export const Route = createFileRoute("/")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();
	const { data: session } = useReactQuery(sessionQuery());

	return (
		<div className="min-h-svh">
			{/* Subtle ambient glow */}
			<div
				className="pointer-events-none fixed inset-0"
				style={{
					background:
						"radial-gradient(ellipse 80% 50% at 50% -10%, oklch(0.55 0.12 265 / 0.06), transparent)",
				}}
			/>

			<div className="relative">
				<MarketingHeader variant="hero" />

				<main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-24">
					{/* Hero */}
					<section className="pb-24 pt-12 md:pt-20">
						<div className="grid items-start gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
							<div className="flex flex-col gap-8">
								<div className="flex flex-col gap-3">
									<h1 className="font-display text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl">
										{t("Your inbox,")}
										<br />
										<span className="text-primary italic">{t("refined.")}</span>
									</h1>
									<p className="mt-4 max-w-md text-lg font-medium text-muted-foreground sm:text-xl">
										{t(
											"A fast, focused email client built for clarity. Tame your inbox, find anything instantly, and stay on top of what matters.",
										)}
									</p>
								</div>
								<div className="flex flex-wrap gap-3">
									{session ? (
										<Button size="lg" render={<Link to="/app" />}>
											{t("Go to Dashboard")}
										</Button>
									) : (
										<>
											<Button size="lg" render={<Link to="/signup" />}>
												{t("Get Started")}
											</Button>
											<Button variant="outline" size="lg" render={<Link to="/login" />}>
												{t("Login")}
											</Button>
										</>
									)}
								</div>
							</div>

							<div className="mt-4 lg:mt-8">
								<Card className="shadow-xl">
									<CardHeader>
										<CardTitle className="flex items-center justify-between">
											{t("Q4 Design Review")}
											<Badge variant="secondary">{t("Design")}</Badge>
										</CardTitle>
										<CardDescription>
											{t("Sarah Chen")} &mdash; {t("2 hours ago")}
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="flex flex-col gap-3 border-t-2 border-border pt-4">
											<p className="text-sm leading-relaxed text-foreground">
												{t(
													"Hey team, I've attached the updated mockups for the dashboard redesign. Let me know your thoughts on the new navigation layout before Friday.",
												)}
											</p>
											<div className="flex items-center gap-3 border-t-2 border-dashed border-border pt-3">
												<span className="font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
													{t("Labels")}
												</span>
												<div className="flex flex-wrap gap-1.5">
													<Badge variant="outline">{t("Design")}</Badge>
													<Badge variant="outline">{t("Review")}</Badge>
													<Badge variant="outline">{t("Q4")}</Badge>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					</section>

					{/* Features */}
					<section className="border-t border-border pt-16">
						<div className="mb-10">
							<h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
								{t("Everything you need.")}{" "}
								<span className="text-muted-foreground">{t("Nothing you don't.")}</span>
							</h2>
						</div>

						<div className="grid gap-4 md:grid-cols-3">
							<Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
										<InboxIcon className="size-5" />
									</div>
									<CardTitle>{t("Inbox")}</CardTitle>
									<CardDescription>
										{t(
											"Smart inbox that learns what matters. Priority sorting, custom filters, and keyboard-first navigation.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Priority")}</Badge>
									<Badge variant="outline">{t("Filters")}</Badge>
									<Badge variant="outline">{t("Shortcuts")}</Badge>
								</CardContent>
							</Card>

							<Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shadow-sm">
										<MessageSquareIcon className="size-5" />
									</div>
									<CardTitle>{t("Threads")}</CardTitle>
									<CardDescription>
										{t(
											"Follow conversations naturally with threaded views. Reply in context without losing track.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Conversations")}</Badge>
									<Badge variant="outline">{t("Context")}</Badge>
									<Badge variant="outline">{t("History")}</Badge>
								</CardContent>
							</Card>

							<Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-sm">
										<SearchIcon className="size-5" />
									</div>
									<CardTitle>{t("Search")}</CardTitle>
									<CardDescription>
										{t(
											"Find any email instantly. Full-text search across your entire archive with smart filters.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Full-text")}</Badge>
									<Badge variant="outline">{t("Filters")}</Badge>
									<Badge variant="outline">{t("Instant")}</Badge>
								</CardContent>
							</Card>
						</div>
					</section>

					{/* CTA */}
					<section className="mt-24">
						<div className="rounded-xl border border-border bg-card p-8 shadow-lg md:p-12">
							<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
								<div className="flex flex-col gap-2">
									<h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
										{t("Ready to take control?")}
									</h2>
									<p className="max-w-md text-muted-foreground">
										{session
											? t("Head back to your inbox and stay on top of things.")
											: t("Sign up free and experience email the way it should be.")}
									</p>
								</div>
								<div className="flex flex-col gap-3 sm:flex-row">
									{session ? (
										<Button size="lg" render={<Link to="/app" />}>
											{t("Go to Dashboard")}
										</Button>
									) : (
										<>
											<Button size="lg" render={<Link to="/signup" />}>
												{t("Sign Up")}
											</Button>
											<Button variant="outline" size="lg" render={<Link to="/login" />}>
												{t("Login")}
											</Button>
										</>
									)}
								</div>
							</div>
						</div>
					</section>
				</main>

				<footer className="border-t border-border px-6 py-8">
					<div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
						<p className="text-xs font-medium text-muted-foreground">
							{t("By using this service, you agree to our")}{" "}
							<Link
								to="/terms-of-service"
								className="underline underline-offset-4 hover:text-primary"
							>
								{t("Terms of Service")}
							</Link>{" "}
							{t("and acknowledge our")}{" "}
							<Link
								to="/privacy-policy"
								className="underline underline-offset-4 hover:text-primary"
							>
								{t("Privacy Policy")}
							</Link>
							.
						</p>
					</div>
				</footer>
			</div>
		</div>
	);
}
