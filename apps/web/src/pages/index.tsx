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

	const authed = Boolean(session);

	return (
		<div className="min-h-svh bg-background text-foreground">
			<Header authed={authed} />
			<Hero authed={authed} />
			<WhatItIs />
			<Bottom authed={authed} />
		</div>
	);
}

function Header({ authed }: { authed: boolean }) {
	return (
		<header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
			<Link to="/" className="flex items-center gap-2">
				<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<SparkleIcon className="size-3.5" />
				</div>
				<span className="text-sm font-semibold tracking-tight">Leuchtturm</span>
			</Link>
			<div className="flex items-center gap-2">
				<Switch>
					<Match when={authed}>
						<Button size="sm" nativeButton={false} render={<Link to="/app" role={undefined} />}>
							<T>Dashboard</T>
						</Button>
					</Match>
					<Match when={!authed}>
						<Button
							size="sm"
							variant="ghost"
							nativeButton={false}
							render={<Link to="/login" role={undefined} />}
						>
							<T>Login</T>
						</Button>
						<Button size="sm" nativeButton={false} render={<Link to="/signup" role={undefined} />}>
							<T>Sign Up</T>
						</Button>
					</Match>
				</Switch>
			</div>
		</header>
	);
}

function Hero({ authed }: { authed: boolean }) {
	return (
		<section className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pb-20 sm:pt-28">
			<div className="relative mx-auto max-w-2xl text-center">
				{/* Lighthouse beam visual */}
				<div className="mx-auto mb-8 flex items-center justify-center" aria-hidden="true">
					<div className="relative">
						<div className="size-14 rounded-full bg-primary/10 ring-1 ring-primary/20" />
						<div className="beam" />
					</div>
				</div>

				<style>{`
					.beam {
						position: absolute;
						top: 50%; left: 50%;
						width: 300px; height: 300px;
						transform: translate(-50%, -50%) rotate(-15deg);
						transform-origin: center;
						background: conic-gradient(
							from 0deg,
							transparent 0deg,
							var(--color-primary) 1deg,
							var(--color-primary) 2deg,
							transparent 3deg,
							transparent 180deg,
							transparent 360deg
						);
						opacity: 0.15;
						border-radius: 50%;
						pointer-events: none;
						animation: sweep 4s ease-in-out infinite;
					}
					@keyframes sweep {
						0%, 100% { transform: translate(-50%, -50%) rotate(-15deg); opacity: 0; }
						20% { opacity: 0.15; }
						40% { transform: translate(-50%, -50%) rotate(15deg); opacity: 0.15; }
						60%, 100% { transform: translate(-50%, -50%) rotate(15deg); opacity: 0; }
					}
				`}</style>

				<h1 className="font-serif text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
					<T>Leuchtturm</T>
				</h1>

				<Show when={authed} fallback={<GuestCopy />}>
					<p className="mt-5 text-lg text-muted-foreground">
						<T>Welcome back.</T>
					</p>
					<div className="mt-8 flex justify-center">
						<Button size="lg" nativeButton={false} render={<Link to="/app" role={undefined} />}>
							<T>Go to Dashboard</T>
							<ArrowRightIcon data-icon="inline-end" />
						</Button>
					</div>
				</Show>
			</div>
		</section>
	);
}

function GuestCopy() {
	return (
		<>
			<p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
				<T>A workspace that doesn&apos;t pretend to know what you need before you do.</T>
			</p>
			<div className="mt-8 flex justify-center gap-3">
				<Button size="lg" nativeButton={false} render={<Link to="/signup" role={undefined} />}>
					<T>Get Started</T>
					<ArrowRightIcon data-icon="inline-end" />
				</Button>
				<Button
					size="lg"
					variant="outline"
					nativeButton={false}
					render={<Link to="/login" role={undefined} />}
				>
					<T>Login</T>
				</Button>
			</div>
		</>
	);
}

function WhatItIs() {
	return (
		<section className="mx-auto max-w-6xl px-6 pb-20">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<ThingCard
					icon={<CompassIcon className="size-5" weight="fill" />}
					title={<T>Navigate</T>}
					description={<T>Keyboard-first. Move fast, keep your hands where they belong.</T>}
				/>
				<ThingCard
					icon={<SparkleIcon className="size-5" weight="fill" />}
					title={<T>Automate</T>}
					description={<T>Cut the repetition. Focus on work that needs a brain.</T>}
				/>
				<ThingCard
					className="sm:col-span-2 lg:col-span-1"
					icon={<MagnifyingGlassIcon className="size-5" weight="fill" />}
					title={<T>Search</T>}
					description={<T>Find anything. No folders, no hunting, no time wasted.</T>}
				/>
			</div>
		</section>
	);
}

function ThingCard({
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
			className={`border-border/60 transition-colors hover:border-border hover:bg-muted/30 ${className ?? ""}`.trim()}
		>
			<CardContent>
				<div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
					{icon}
				</div>
				<h3 className="mt-4 text-base font-semibold">{title}</h3>
				<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
			</CardContent>
		</Card>
	);
}

function Bottom({ authed }: { authed: boolean }) {
	return (
		<div className="border-t border-border">
			<section className="mx-auto max-w-6xl px-6 py-20">
				<div className="mx-auto max-w-xl text-center">
					<div className="mx-auto mb-6 flex size-10 items-center justify-center rounded-full bg-primary/10">
						<CompassIcon className="size-4 text-primary" weight="fill" />
					</div>
					<p className="text-base text-muted-foreground">
						<Show when={authed} fallback={<T>Built in the open. Shaped by the people using it.</T>}>
							<T>Your workspace, waiting for you.</T>
						</Show>
					</p>
					<div className="mt-7 flex justify-center gap-3">
						<Switch>
							<Match when={authed}>
								<Button size="lg" nativeButton={false} render={<Link to="/app" role={undefined} />}>
									<T>Go to Dashboard</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
							</Match>
							<Match when={!authed}>
								<Button
									size="lg"
									nativeButton={false}
									render={<Link to="/signup" role={undefined} />}
								>
									<T>Sign Up</T>
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
								<Button
									size="lg"
									variant="outline"
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

			<footer className="mx-auto max-w-6xl border-t border-border px-6 py-6">
				<div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
					<p className="text-xs text-muted-foreground">
						<Link
							to="/terms-of-service"
							className="underline underline-offset-4 hover:text-foreground"
						>
							<T>Terms of Service</T>
						</Link>
						{" · "}
						<Link
							to="/privacy-policy"
							className="underline underline-offset-4 hover:text-foreground"
						>
							<T>Privacy Policy</T>
						</Link>
					</p>
					<Switch>
						<Match when={authed}>
							<Link
								to="/app"
								className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
							>
								<T>Dashboard</T>
							</Link>
						</Match>
						<Match when={!authed}>
							<div className="flex gap-4">
								<Link
									to="/login"
									className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
								>
									<T>Login</T>
								</Link>
								<Link
									to="/signup"
									className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
								>
									<T>Sign Up</T>
								</Link>
							</div>
						</Match>
					</Switch>
				</div>
			</footer>
		</div>
	);
}
