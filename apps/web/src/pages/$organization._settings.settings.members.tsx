import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/settings/members")({
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationMembers({ organizationId }));
	},
	component: Page,
});

function Page() {
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const [members] = useZeroQuery(queries.organizationMembers({ organizationId }));

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Organization members")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("Manage access at the organization level.")}
					</p>
				</div>
				<div className="mt-5">
					{members.length ? (
						<ul className="divide-y divide-border">
							{members.map((member) => (
								<li key={member.id} className="flex items-center justify-between gap-4 py-4">
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
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("No members found.")}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
