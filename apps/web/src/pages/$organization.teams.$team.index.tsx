import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

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
			<div className="mx-auto flex w-full max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto w-full max-w-3xl">
					<h1 className="text-lg font-semibold">{team?.name}</h1>
					<p className="text-sm text-muted-foreground">{t("This is your team workspace.")}</p>
				</div>
			</div>
		</div>
	);
}
