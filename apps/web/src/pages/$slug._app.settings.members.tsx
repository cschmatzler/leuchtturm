import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { organizationMembersQuery } from "@leuchtturm/web/queries/teams";

export const Route = createFileRoute("/$slug/_app/settings/members")({
	component: Page,
});

function Page() {
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const { data: members } = useQuery(organizationMembersQuery(organizationId));

	return (
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="px-6 py-5">
				<CardTitle className="text-base">{t("Organization members")}</CardTitle>
				<CardDescription>{t("Manage access at the organization level.")}</CardDescription>
			</CardHeader>
			<CardContent className="border-t border-border p-0">
				{members?.length ? (
					<ul className="divide-y divide-border">
						{members.map((member) => (
							<li key={member.id} className="flex items-center justify-between gap-4 px-6 py-4">
								<div>
									<p className="text-sm font-medium">{member.user?.name ?? member.userId}</p>
									{member.user?.email && (
										<p className="text-xs text-muted-foreground">{member.user.email}</p>
									)}
								</div>
								<p className="text-sm text-muted-foreground">{member.role}</p>
							</li>
						))}
					</ul>
				) : (
					<div className="px-6 py-10 text-center text-sm text-muted-foreground">
						{t("No members found.")}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
