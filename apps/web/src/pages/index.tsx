import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRightIcon, InboxIcon, MailIcon, MessageSquareIcon, SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";
import { Card, CardContent } from "@chevrotain/web/components/ui/card";
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
			{/* ── Hero ── */}
			<div className="relative overflow-hidden bg-foreground text-background">
				{/* Ambient effects */}
				<div className="pointer-events-none absolute inset-0" aria-hidden="true">
					<div className="animate-glow absolute left-1/2 top-[38%] size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[120px]" />
					<div
						className="absolute inset-0 opacity-[0.035]"
						style={{
							backgroundImage:
								"linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
							backgroundSize: "64px 64px",
						}}
					/>
				</div>

				<header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
					<Link to="/" className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-lg bg-background/15">
							<MailIcon className="size-4" />
						</div>
						<span className="text-base font-semibold tracking-tight">Chevrotain</span>
					</Link>
					<div className="flex items-center gap-2">
						{session ? (
							<Button
								size="sm"
								className="bg-background text-foreground hover:bg-background/90"
								render={<Link to="/app" />}
							>
								{t("Dashboard")}
							</Button>
						) : (
							<>
								<Button
									variant="ghost"
									size="sm"
									className="text-background/70 hover:bg-background/10 hover:text-background"
									render={<Link to="/login" />}
								>
									{t("Login")}
								</Button>
								<Button
									size="sm"
									className="bg-background text-foreground hover:bg-background/90"
									render={<Link to="/signup" />}
								>
									{t("Sign Up")}
								</Button>
							</>
						)}
					</div>
				</header>

				<section className="relative mx-auto max-w-7xl px-6 pb-40 pt-28 md:pb-52 md:pt-36">
					<div className="mx-auto max-w-3xl text-center">
						<div className="animate-hero inline-flex items-center gap-2 rounded-full border border-background/10 bg-background/[0.06] px-4 py-1.5 text-xs font-medium tracking-wide text-background/60">
							<MailIcon className="size-3" />
							{t("Built for clarity")}
						</div>
						<h1
							className="animate-hero mt-8 font-display text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
							style={{ animationDelay: "0.08s" }}
						>
							{t("Your inbox, refined.")}
						</h1>
						<p
							className="animate-hero mx-auto mt-7 max-w-lg text-lg leading-relaxed text-background/45"
							style={{ animationDelay: "0.16s" }}
						>
							{t(
								"A fast, focused email client built for clarity. Tame your inbox, find anything instantly, and stay on top of what matters.",
							)}
						</p>
						<div
							className="animate-hero mt-11 flex justify-center gap-3"
							style={{ animationDelay: "0.24s" }}
						>
							{session ? (
								<Button
									size="lg"
									className="bg-background text-foreground hover:bg-background/90"
									render={<Link to="/app" />}
								>
									{t("Go to Dashboard")}
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
							) : (
								<>
									<Button
										size="lg"
										className="bg-background text-foreground hover:bg-background/90"
										render={<Link to="/signup" />}
									>
										{t("Get Started")}
										<ArrowRightIcon data-icon="inline-end" />
									</Button>
									<Button
										variant="outline"
										size="lg"
										className="border-background/20 text-background hover:bg-background/10 hover:text-background"
										render={<Link to="/login" />}
									>
										{t("Login")}
									</Button>
								</>
							)}
						</div>
					</div>
				</section>
			</div>

			<main id="main-content">
				{/* ── Features ── */}
				<section className="mx-auto max-w-7xl px-6 py-28 md:py-36">
					<div className="max-w-xl">
						<h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
							{t("Everything you need.")}
						</h2>
						<p className="mt-3 text-lg leading-relaxed text-muted-foreground">
							{t("Nothing you don't.")}
						</p>
					</div>

					<div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						<Card className="group border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
							<CardContent>
								<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
									<InboxIcon className="size-5" />
								</div>
								<h3 className="mt-5 text-lg font-semibold">{t("Inbox")}</h3>
								<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
									{t(
										"Smart inbox that learns what matters. Priority sorting, custom filters, and keyboard-first navigation that keeps your hands where they belong.",
									)}
								</p>
							</CardContent>
						</Card>

						<Card className="group border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md">
							<CardContent>
								<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
									<MessageSquareIcon className="size-5" />
								</div>
								<h3 className="mt-5 text-lg font-semibold">{t("Threads")}</h3>
								<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
									{t(
										"Follow conversations naturally. Reply in context without ever losing track of the thread.",
									)}
								</p>
							</CardContent>
						</Card>

						<Card className="group border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md sm:col-span-2 lg:col-span-1">
							<CardContent>
								<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
									<SearchIcon className="size-5" />
								</div>
								<h3 className="mt-5 text-lg font-semibold">{t("Search")}</h3>
								<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
									{t(
										"Find any email instantly. Full-text search across your entire archive with smart filters.",
									)}
								</p>
							</CardContent>
						</Card>
					</div>
				</section>

				{/* ── CTA ── */}
				<section className="mx-auto max-w-7xl px-6 pb-28 md:pb-36">
					<div className="relative overflow-hidden rounded-2xl bg-foreground text-background">
						<div className="pointer-events-none absolute inset-0" aria-hidden="true">
							<div className="absolute bottom-0 left-1/2 h-[350px] w-[600px] -translate-x-1/2 translate-y-1/4 rounded-full bg-primary/[0.15] blur-[100px]" />
						</div>
						<div className="relative px-6 py-24 text-center md:py-28">
							<h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
								{t("Ready to take control?")}
							</h2>
							<p className="mx-auto mt-4 max-w-xl text-background/45">
								{session
									? t("Head back to your inbox and stay on top of things.")
									: t("Sign up free and experience email the way it should be.")}
							</p>
							<div className="mt-9 flex justify-center gap-3">
								{session ? (
									<Button
										size="lg"
										className="bg-background text-foreground hover:bg-background/90"
										render={<Link to="/app" />}
									>
										{t("Go to Dashboard")}
										<ArrowRightIcon data-icon="inline-end" />
									</Button>
								) : (
									<>
										<Button
											size="lg"
											className="bg-background text-foreground hover:bg-background/90"
											render={<Link to="/signup" />}
										>
											{t("Sign Up")}
											<ArrowRightIcon data-icon="inline-end" />
										</Button>
										<Button
											variant="outline"
											size="lg"
											className="border-background/20 text-background hover:bg-background/10 hover:text-background"
											render={<Link to="/login" />}
										>
											{t("Login")}
										</Button>
									</>
								)}
							</div>
						</div>
					</div>
				</section>
			</main>

			{/* ── Footer ── */}
			<footer className="border-t border-border px-6 py-16">
				<div className="mx-auto max-w-7xl">
					<div className="grid gap-10 sm:grid-cols-3">
						<div className="flex flex-col gap-3">
							<Link to="/" className="flex items-center gap-2.5">
								<div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
									<MailIcon className="size-4" />
								</div>
								<span className="text-base font-semibold">Chevrotain</span>
							</Link>
							<p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
								{t("A fast, focused email client built for people who value clarity.")}
							</p>
						</div>
						<div>
							<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
								{t("Legal")}
							</h3>
							<nav className="mt-4 flex flex-col gap-2.5">
								<Link
									to="/terms-of-service"
									className="text-sm text-foreground/70 transition-colors hover:text-foreground"
								>
									{t("Terms of Service")}
								</Link>
								<Link
									to="/privacy-policy"
									className="text-sm text-foreground/70 transition-colors hover:text-foreground"
								>
									{t("Privacy Policy")}
								</Link>
							</nav>
						</div>
						<div>
							<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
								{t("Account")}
							</h3>
							<nav className="mt-4 flex flex-col gap-2.5">
								{session ? (
									<Link
										to="/app"
										className="text-sm text-foreground/70 transition-colors hover:text-foreground"
									>
										{t("Dashboard")}
									</Link>
								) : (
									<>
										<Link
											to="/signup"
											className="text-sm text-foreground/70 transition-colors hover:text-foreground"
										>
											{t("Sign Up")}
										</Link>
										<Link
											to="/login"
											className="text-sm text-foreground/70 transition-colors hover:text-foreground"
										>
											{t("Login")}
										</Link>
									</>
								)}
							</nav>
						</div>
					</div>
					<div className="mt-14 border-t border-border pt-6">
						<p className="text-xs text-muted-foreground">
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
				</div>
			</footer>
		</div>
	);
}
