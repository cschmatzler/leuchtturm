import { Link, type LinkOptions } from "@tanstack/react-router";
import { SearchXIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";

export function NotFound({ backTo, backLabel }: { backTo: LinkOptions; backLabel: string }) {
	const { t } = useTranslation();

	return (
		<div className="flex size-full flex-col items-center justify-center gap-5 px-6">
			<div className="flex size-16 items-center justify-center rounded-full bg-muted">
				<SearchXIcon className="size-7 text-muted-foreground" />
			</div>
			<div className="flex flex-col items-center gap-1.5">
				<h1 className="font-display text-2xl font-bold">{t("Not found")}</h1>
				<p className="text-muted-foreground text-sm">
					{t("The page you're looking for doesn't exist.")}
				</p>
			</div>
			<Button variant="outline" render={<Link {...backTo} />}>
				{backLabel}
			</Button>
		</div>
	);
}
