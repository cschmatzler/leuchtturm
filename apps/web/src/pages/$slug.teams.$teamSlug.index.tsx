import { createFileRoute } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { Link } from "@leuchtturm/web/components/ui/link";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$slug/teams/$teamSlug/")({
	component: Page,
});

function Page() {
	const { slug, teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, teamSlug }));

	return (
		<div className="flex grow justify-center bg-background">
			<div className="flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto w-full max-w-3xl">
					<Card className="gap-0 overflow-hidden p-0">
						<CardHeader className="px-6 py-5">
							<CardTitle className="text-base">{team?.name}</CardTitle>
							<CardDescription>{t("This is your team workspace.")}</CardDescription>
						</CardHeader>
						<CardContent className="border-t border-border px-6 py-5">
							<Button
								variant="outline"
								render={
									<Link to="/$slug/teams/$teamSlug/settings/general" params={{ slug, teamSlug }} />
								}
							>
								<SettingsIcon className="size-4" />
								{t("Team settings")}
							</Button>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
