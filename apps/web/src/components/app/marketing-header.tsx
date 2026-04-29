import { SparkleIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@leuchtturm/web/components/ui/button";
import { cn } from "@leuchtturm/web/lib/cn";
import { useReactQuery } from "@leuchtturm/web/lib/query";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export type MarketingHeaderProps = {
	variant?: "default" | "hero";
};

export function MarketingHeader({ variant = "default" }: MarketingHeaderProps) {
	const { t } = useTranslation();
	const { data: session, isLoading } = useReactQuery(sessionQuery());

	return (
		<header
			className={cn(
				"sticky top-0 z-30 w-full",
				variant === "default" && "border-b border-border bg-background/80 backdrop-blur-md",
				variant === "hero" && "bg-transparent",
			)}
		>
			<div
				className={cn(
					"mx-auto flex w-full items-center justify-between",
					variant === "default" && "max-w-5xl px-6 py-4",
					variant === "hero" && "max-w-7xl px-6 py-5",
				)}
			>
				<Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
					<div
						className={cn(
							"flex items-center justify-center rounded-lg bg-primary text-primary-foreground",
							variant === "default" && "size-7",
							variant === "hero" && "size-8",
						)}
					>
						<SparkleIcon
							className={cn(variant === "default" && "size-4", variant === "hero" && "size-4")}
						/>
					</div>
					<span className="text-base font-semibold">Leuchtturm</span>
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
