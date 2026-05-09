import { createFileRoute } from "@tanstack/react-router";
import { T } from "gt-react";

import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team/")({
	component: Page,
});

function Page() {
	const { team } = Route.useParams();

	return <TeamPage team={team} />;
}

function TeamPage(props: { readonly team: string }) {
	const { organizationId } = Route.useRouteContext();
	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));

	return (
		<div className="flex h-full justify-center">
			<div className="mx-auto flex w-full max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto w-full max-w-3xl">
					<h1 className="text-lg font-semibold">{team?.name}</h1>
					<p className="text-sm text-muted-foreground">
						<T>This is your team workspace.</T>
					</p>
				</div>
			</div>
		</div>
	);
}
