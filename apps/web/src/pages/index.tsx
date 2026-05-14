import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { CompassIcon } from "@phosphor-icons/react/Compass";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/MagnifyingGlass";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { createFileRoute, Link } from "@tanstack/react-router";
import { T } from "gt-react";
import type { ReactNode } from "react";

import { Button } from "@leuchtturm/web/components/ui/button";
import { Card, CardContent } from "@leuchtturm/web/components/ui/card";
import { Match, Show, Switch } from "@leuchtturm/web/components/ui/flow";
import { useReactQuery } from "@leuchtturm/web/lib/query";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/")({
	component: Page,
});

function Page() {
	const { data: session } = useReactQuery(sessionQuery());

	return (
		<div className="min-h-svh">
			<HeroSection isAuthenticated={Boolean(session)} />
			<main id="main-content">
				<FeaturesSection />
				<CallToActionSection isAuthenticated={Boolean(session)} />
			</main>
			<MarketingFooter isAuthenticated={Boolean(session)} />
		</div>
	);
}

function HeroSection({ isAuthenticated }: { isAuthenticated: boolean }) {
	return (
		<div className="relative overflow-hidden bg-foreground text-background">
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
				<BrandLink />
				<div className="flex items-center gap-2">
					<Switch>
						<Match when={isAuthenticated}>
							<Button
								size="sm"
								className="bg-background text-foreground hover:bg-background/90"
								nativeButton={false}
								render={<Link to="/app" role={undefined} />}
							>
								<T>Dashboard</T>
							</Button>
						</Match>
						<Match when={!isAuthenticated}>
							<Button
								variant="ghost"
								size="sm"
								className="text-background/70 hover:bg-background/10 hover:text-background"
								nativeButton={false}
								render={<Link to="/login" role={undefined} />}
							>
								<T>Login</T>
							</Button>
							<Button
								size="sm"
								className="bg-background text-foreground hover:bg-background/90"
								nativeButton={false}
								render={<Link to="/signup" role={undefined} />}
							>
								<T>Sign Up</T>
							</Button>
						</Match>
					</Switch>
				</div>
			</header>

			<section className="relative mx-auto max-w-7xl px-6 pb-40 pt-28 md:pb-52 md:pt-36">
				<div className="mx-auto max-w-3xl text-center">
					<div className="animate-hero inline-flex items-center gap-2 rounded-full border border-background/10 bg-background/[0.06] px-4 py-1.5 text-xs font-medium tracking-wide text-background/60">
						<SparkleIcon className="size-3" />
						<T>Built for focus</T>
					</div>
					<h1
						className="animate-hero mt-8 font-serif text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl"
						style={{ animationDelay: "0.08s" }}
					>
						<T>Your workflow, refined.</T>
					</h1>
					<p
						className="animate-hero mx-auto mt-7 max-w-lg text-lg leading-relaxed text-background/45"
						style={{ animationDelay: "0.16s" }}
					>
						<T>
							A fast, focused workspace built for clarity. Keep your projects organized, find what
							you need instantly, and stay on top of what matters.
						</T>
					</p>
					<div
						className="animate-hero mt-11 flex justify-center gap-3"
						style={{ animationDelay: "0.24s" }}
					>
						<Switch>
							<Match when={isAuthenticated}>
								<Button
									size="lg"
									className="bg-background text-foreground hover:bg-background/90"
									nativeButton={false}
									render={<Link to="/app" role={undefined} />}
								>
									<T>Go to Dashboard</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
							</Match>
							<Match when={!isAuthenticated}>
								<Button
									size="lg"
									className="bg-background text-foreground hover:bg-background/90"
									nativeButton={false}
									render={<Link to="/signup" role={undefined} />}
								>
									<T>Get Started</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="border-background/20 text-background hover:bg-background/10 hover:text-background"
									nativeButton={false}
									render={<Link to="/login" role={undefined} />}
								>
									<T>Login</T>
								</Button>
							</Match>
						</Switch>
					</div>
				</div>
			</section>
		</div>
	);
}

function FeaturesSection() {
	return (
		<section className="mx-auto max-w-7xl px-6 py-28 md:py-36">
			<div className="max-w-xl">
				<h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
					<T>Everything you need.</T>
				</h2>
				<p className="mt-3 text-lg leading-relaxed text-muted-foreground">
					<T>Nothing you don&apos;t.</T>
				</p>
			</div>

			<div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				<FeatureCard
					icon={<CompassIcon className="size-5" />}
					title={<T>Workspace</T>}
					description={
						<T>
							Stay organized with a clean, keyboard-first workspace designed for speed and focus.
						</T>
					}
				/>
				<FeatureCard
					icon={<SparkleIcon className="size-5" />}
					title={<T>Automation</T>}
					description={
						<T>Automate repetitive tasks and spend more time on the work that actually matters.</T>
					}
				/>
				<FeatureCard
					className="sm:col-span-2 lg:col-span-1"
					icon={<MagnifyingGlassIcon className="size-5" />}
					title={<T>Search</T>}
					description={<T>Find anything instantly with fast, reliable full-text search.</T>}
				/>
			</div>
		</section>
	);
}

function FeatureCard({
	icon,
	title,
	description,
	className,
}: {
	icon: ReactNode;
	title: ReactNode;
	description: ReactNode;
	className?: string;
}) {
	return (
		<Card
			className={`group border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md ${className ?? ""}`.trim()}
		>
			<CardContent>
				<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
					{icon}
				</div>
				<h3 className="mt-5 text-lg font-semibold">{title}</h3>
				<p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}

function CallToActionSection({ isAuthenticated }: { isAuthenticated: boolean }) {
	return (
		<section className="mx-auto max-w-7xl px-6 pb-28 md:pb-36">
			<div className="relative overflow-hidden rounded-2xl bg-foreground text-background">
				<div className="pointer-events-none absolute inset-0" aria-hidden="true">
					<div className="absolute bottom-0 left-1/2 h-[350px] w-[600px] -translate-x-1/2 translate-y-1/4 rounded-full bg-primary/[0.15] blur-[100px]" />
				</div>
				<div className="relative px-6 py-24 text-center md:py-28">
					<h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
						<T>Ready to take control?</T>
					</h2>
					<p className="mx-auto mt-4 max-w-xl text-background/45">
						<Show when={isAuthenticated} fallback={<T>Sign up free and stay in flow.</T>}>
							<T>Head back to your workspace and keep moving.</T>
						</Show>
					</p>
					<div className="mt-9 flex justify-center gap-3">
						<Switch>
							<Match when={isAuthenticated}>
								<Button
									size="lg"
									className="bg-background text-foreground hover:bg-background/90"
									nativeButton={false}
									render={<Link to="/app" role={undefined} />}
								>
									<T>Go to Dashboard</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
							</Match>
							<Match when={!isAuthenticated}>
								<Button
									size="lg"
									className="bg-background text-foreground hover:bg-background/90"
									nativeButton={false}
									render={<Link to="/signup" role={undefined} />}
								>
									<T>Sign Up</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
								<Button
									variant="outline"
									size="lg"
									className="border-background/20 text-background hover:bg-background/10 hover:text-background"
									nativeButton={false}
									render={<Link to="/login" role={undefined} />}
								>
									<T>Login</T>
								</Button>
							</Match>
						</Switch>
					</div>
				</div>
			</div>
		</section>
	);
}

function MarketingFooter({ isAuthenticated }: { isAuthenticated: boolean }) {
	return (
		<footer className="border-t border-border px-6 py-16">
			<div className="mx-auto max-w-7xl">
				<div className="grid gap-10 sm:grid-cols-3">
					<div className="flex flex-col gap-3">
						<BrandLink accent />
						<p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
							<T>A fast, focused app built for people who value clarity.</T>
						</p>
					</div>
					<div>
						<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
							<T>Legal</T>
						</h3>
						<nav className="mt-4 flex flex-col gap-2.5">
							<Link
								to="/terms-of-service"
								className="text-sm text-foreground/70 transition-colors hover:text-foreground"
							>
								<T>Terms of Service</T>
							</Link>
							<Link
								to="/privacy-policy"
								className="text-sm text-foreground/70 transition-colors hover:text-foreground"
							>
								<T>Privacy Policy</T>
							</Link>
						</nav>
					</div>
					<div>
						<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
							<T>Account</T>
						</h3>
						<nav className="mt-4 flex flex-col gap-2.5">
							<Switch>
								<Match when={isAuthenticated}>
									<Link
										to="/app"
										className="text-sm text-foreground/70 transition-colors hover:text-foreground"
									>
										<T>Dashboard</T>
									</Link>
								</Match>
								<Match when={!isAuthenticated}>
									<Link
										to="/signup"
										className="text-sm text-foreground/70 transition-colors hover:text-foreground"
									>
										<T>Sign Up</T>
									</Link>
									<Link
										to="/login"
										className="text-sm text-foreground/70 transition-colors hover:text-foreground"
									>
										<T>Login</T>
									</Link>
								</Match>
							</Switch>
						</nav>
					</div>
				</div>
				<div className="mt-14 border-t border-border pt-6">
					<p className="text-xs text-muted-foreground">
						<T>By using this service, you agree to our</T>{" "}
						<Link
							to="/terms-of-service"
							className="underline underline-offset-4 hover:text-primary"
						>
							<T>Terms of Service</T>
						</Link>{" "}
						<T>and acknowledge our</T>{" "}
						<Link to="/privacy-policy" className="underline underline-offset-4 hover:text-primary">
							<T>Privacy Policy</T>
						</Link>
						.
					</p>
				</div>
			</div>
		</footer>
	);
}

function BrandLink({ accent = false }: { accent?: boolean }) {
	return (
		<Link to="/" className="flex items-center gap-2.5">
			<div
				className={
					accent
						? "flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
						: "flex size-8 items-center justify-center rounded-lg bg-background/15"
				}
			>
				<SparkleIcon className="size-4" />
			</div>
			<span className="text-base font-semibold tracking-tight">Leuchtturm</span>
		</Link>
	);
}
