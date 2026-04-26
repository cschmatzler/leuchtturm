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

export const Route = createFileRoute("/$slug/_app/teams/$teamId/")({
	component: Page,
});

function Page() {
	const { slug, teamId } = Route.useParams();
	const { team } = Route.useRouteContext();
	const { t } = useTranslation();

	return (
		<div className="flex grow justify-center bg-background">
			<div className="flex max-w-7xl grow flex-col gap-4 px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
				<div className="mx-auto w-full max-w-3xl">
					<Card className="gap-0 overflow-hidden p-0">
						<CardHeader className="px-6 py-5">
							<CardTitle className="text-base">{team.name}</CardTitle>
							<CardDescription>{t("This is your team workspace.")}</CardDescription>
						</CardHeader>
						<CardContent className="border-t border-border px-6 py-5">
							<Button
								variant="outline"
								render={<Link to="/$slug/teams/$teamId/settings" params={{ slug, teamId }} />}
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
