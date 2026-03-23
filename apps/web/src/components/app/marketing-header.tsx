import { Link } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";
import { cn } from "@chevrotain/web/lib/cn";
import { useReactQuery } from "@chevrotain/web/lib/query";
import { sessionQuery } from "@chevrotain/web/queries/session";

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
					className={cn(
						"flex items-center gap-2.5 font-semibold transition-colors hover:text-primary",
						variant === "hero" && "text-base",
					)}
				>
					<div
						className={cn(
							"flex items-center justify-center rounded-lg bg-primary text-primary-foreground",
							variant === "default" && "size-7",
							variant === "hero" && "size-9",
						)}
					>
						<MailIcon
							className={cn(variant === "default" && "size-4", variant === "hero" && "size-5")}
						/>
					</div>
					<span className="font-display text-lg font-semibold">Chevrotain</span>
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
