import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@roasted/web/components/ui/button";
import { cn } from "@roasted/web/lib/cn";
import { useReactQuery } from "@roasted/web/lib/query";
import { sessionQuery } from "@roasted/web/queries/session";

type MarketingHeaderProps = {
	variant?: "default" | "hero";
};

export function MarketingHeader({ variant = "default" }: MarketingHeaderProps) {
	const { t } = useTranslation();
	const { data: session, isLoading } = useReactQuery(sessionQuery());

	return (
		<header
			className={cn("w-full", variant === "default" && "border-b", variant === "hero" && "mx-auto")}
		>
			<div
				className={cn(
					"mx-auto flex w-full items-center justify-between",
					variant === "default" && "max-w-5xl px-6 py-4",
					variant === "hero" && "max-w-7xl px-6 py-6",
				)}
			>
				<Link
					to="/"
					className={cn("flex items-center gap-2 font-semibold", variant === "hero" && "text-base")}
				>
					<div
						className={cn(
							"bg-primary text-primary-foreground flex items-center justify-center",
							variant === "default" && "size-7 rounded-md",
							variant === "hero" && "size-9 rounded-lg",
						)}
					>
						<svg
							aria-hidden="true"
							className={cn(variant === "default" && "size-4", variant === "hero" && "size-5")}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"
							/>
						</svg>
					</div>
					<span>Sixth Coffee</span>
				</Link>
				{!isLoading && (
					<div className="flex items-center gap-2">
						{session ? (
							<Button size="sm" render={<Link to="/app" />}>
								{t("Dashboard")}
							</Button>
						) : (
							<>
								<Button variant="ghost" size="sm" render={<Link to="/login" />}>
									{t("Login")}
								</Button>
								<Button size="sm" render={<Link to="/signup" />}>
									{t("Sign Up")}
								</Button>
							</>
						)}
					</div>
				)}
			</div>
		</header>
	);
}
