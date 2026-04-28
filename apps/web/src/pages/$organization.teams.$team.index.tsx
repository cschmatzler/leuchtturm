import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Card, CardDescription, CardHeader, CardTitle } from "@leuchtturm/web/components/ui/card";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team/")({
	component: Page,
});

function Page() {
	const { team: teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, teamSlug }));

	return (
		<div className="flex h-full justify-center">
			<div className="mx-auto flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto max-w-3xl">
					<Card className="gap-0 overflow-hidden p-0">
						<CardHeader className="px-6 py-5">
							<CardTitle className="text-base">{team?.name}</CardTitle>
							<CardDescription>{t("This is your team workspace.")}</CardDescription>
						</CardHeader>
					</Card>
				</div>
			</div>
		</div>
	);
}
