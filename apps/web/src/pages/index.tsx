import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { MarketingHeader } from "@one/web/components/app/marketing-header";
import { Badge } from "@one/web/components/ui/badge";
import { Button } from "@one/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@one/web/components/ui/card";
import { useReactQuery } from "@one/web/lib/query";
import { sessionQuery } from "@one/web/queries/session";

export const Route = createFileRoute("/")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();
	const { data: session } = useReactQuery(sessionQuery());

	return (
		<div className="min-h-svh">
			<div
				className="pointer-events-none fixed inset-0 opacity-[0.03]"
				style={{
					backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			/>

			<div className="relative">
				<MarketingHeader variant="hero" />

				<main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col px-6 pb-24">
					<section className="pb-24 pt-12 md:pt-20">
						<div className="grid items-start gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
							<div className="flex flex-col gap-8">
								<div className="flex flex-col gap-2">
									<h1 className="text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl">
										{t("Track")}
										<br />
										<span className="text-primary">{t("every")}</span> {t("brew.")}
									</h1>
									<p className="mt-4 max-w-md text-lg font-medium text-muted-foreground sm:text-xl">
										{t(
											"A simple coffee journal for home brewers. Log recipes, track beans, discover what tastes best.",
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
												{t("Start Logging")}
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
											{t("V60 Pour Over")}
											<Badge variant="secondary">4.8</Badge>
										</CardTitle>
										<CardDescription>
											{t("Ethiopia Yirgacheffe")} &mdash; {t("Light Roast")}
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="grid grid-cols-3 gap-4 border-t-2 border-border pt-4">
											<div className="flex flex-col gap-0.5">
												<span className="font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
													{t("Dose")}
												</span>
												<span className="text-lg font-semibold">18g</span>
											</div>
											<div className="flex flex-col gap-0.5">
												<span className="font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
													{t("Yield")}
												</span>
												<span className="text-lg font-semibold">36g</span>
											</div>
											<div className="flex flex-col gap-0.5">
												<span className="font-heading text-xs font-medium uppercase tracking-wide text-muted-foreground">
													{t("Time")}
												</span>
												<span className="text-lg font-semibold">3:45</span>
											</div>
										</div>
										<p className="mt-4 border-t-2 border-dashed border-border pt-4 text-sm text-muted-foreground">
											{t(
												"Sweet and floral. Notes of blueberry and jasmine. Could grind slightly finer next time.",
											)}
										</p>
									</CardContent>
								</Card>
							</div>
						</div>
					</section>

					<section className="border-t-2 border-border pt-16">
						<div className="mb-10">
							<h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
								{t("Everything you need.")}{" "}
								<span className="text-muted-foreground">{t("Nothing you don't.")}</span>
							</h2>
						</div>

						<div className="grid gap-4 md:grid-cols-3">
							<Card className="shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-12 items-center justify-center border-2 border-border bg-primary text-primary-foreground shadow-sm">
										<svg
											aria-hidden="true"
											className="size-6"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"
											/>
										</svg>
									</div>
									<CardTitle>{t("Brews")}</CardTitle>
									<CardDescription>
										{t(
											"Log every pour-over, espresso, and AeroPress with detailed recipes and tasting notes.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Recipe")}</Badge>
									<Badge variant="outline">{t("Notes")}</Badge>
									<Badge variant="outline">{t("Rating")}</Badge>
								</CardContent>
							</Card>

							<Card className="shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-12 items-center justify-center border-2 border-border bg-secondary text-secondary-foreground shadow-sm">
										<svg
											aria-hidden="true"
											className="size-6"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
											/>
										</svg>
									</div>
									<CardTitle>{t("Beans")}</CardTitle>
									<CardDescription>
										{t(
											"Track origin, roaster, roast date, and remaining stock. Never lose a favourite.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Origin")}</Badge>
									<Badge variant="outline">{t("Roast Date")}</Badge>
									<Badge variant="outline">{t("Stock")}</Badge>
								</CardContent>
							</Card>

							<Card className="shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
								<CardHeader>
									<div className="mb-2 flex size-12 items-center justify-center border-2 border-border bg-accent text-accent-foreground shadow-sm">
										<svg
											aria-hidden="true"
											className="size-6"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
											/>
										</svg>
									</div>
									<CardTitle>{t("Statistics")}</CardTitle>
									<CardDescription>
										{t(
											"Spot patterns in your brewing. See ratings, trends, and your most-used recipes.",
										)}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-wrap gap-2">
									<Badge variant="outline">{t("Trends")}</Badge>
									<Badge variant="outline">{t("Ratings")}</Badge>
									<Badge variant="outline">{t("History")}</Badge>
								</CardContent>
							</Card>
						</div>
					</section>

					<section className="mt-24">
						<div className="border-2 border-border bg-card p-8 shadow-xl md:p-12">
							<div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
								<div className="flex flex-col gap-2">
									<h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
										{t("Ready for your next brew?")}
									</h2>
									<p className="max-w-md text-muted-foreground">
										{session
											? t("Head back to your dashboard and log your next cup.")
											: t("Start a free account and keep your coffee notes tidy.")}
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

				<footer className="border-t-2 border-border px-6 py-8">
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
