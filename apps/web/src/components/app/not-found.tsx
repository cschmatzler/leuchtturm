import { Link, type LinkOptions } from "@tanstack/react-router";
import { SearchXIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@roasted/web/components/ui/button";

export function NotFound({ backTo, backLabel }: { backTo: LinkOptions; backLabel: string }) {
	const { t } = useTranslation();

	return (
		<div className="flex size-full flex-col items-center justify-center gap-4">
			<SearchXIcon className="text-muted-foreground size-12" />
			<h1 className="text-xl font-semibold">{t("Not found")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("The page you're looking for doesn't exist.")}
			</p>
			<Button variant="outline" render={<Link {...backTo} />}>
				{backLabel}
			</Button>
		</div>
	);
}
