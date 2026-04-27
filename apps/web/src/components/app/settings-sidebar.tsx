import { useQuery } from "@tanstack/react-query";
import { CreditCardIcon, LayersIcon, SettingsIcon, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Link } from "@leuchtturm/web/components/ui/link";
import { cn } from "@leuchtturm/web/lib/cn";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { queries } from "@leuchtturm/zero/queries";

export function SettingsSidebar({
	slug,
	organizationId,
	teamSlug,
}: {
	readonly slug: string;
	readonly organizationId: string;
	readonly teamSlug?: string;
}) {
	const { t } = useTranslation();
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const [currentTeam] = useZeroQuery(queries.team({ organizationId, teamSlug: teamSlug ?? "" }));
	const { data: organizations } = useQuery(organizationsQuery());
	const currentOrganization = organizations?.find((org) => org.slug === slug);

	return (
		<nav className="w-52 shrink-0">
			<h2 className="mb-4 px-2 text-sm font-semibold tracking-tight">{t("Settings")}</h2>

			<div className="mb-4">
				<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{t("Account")}</p>
				<ul className="grid gap-0.5">
					<li>
						<Link to="/$slug/settings/profile" params={{ slug }} className={sidebarLinkClassName}>
							<UserIcon className="size-4" />
							{t("Profile")}
						</Link>
					</li>
					<li>
						<Link
							to="/$slug/settings/preferences"
							params={{ slug }}
							className={sidebarLinkClassName}
						>
							<SettingsIcon className="size-4" />
							{t("Preferences")}
						</Link>
					</li>
				</ul>
			</div>

			<div className="mb-4">
				<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
					{currentOrganization?.name ?? t("Organization")}
				</p>
				<ul className="grid gap-0.5">
					<li>
						<Link to="/$slug/settings/members" params={{ slug }} className={sidebarLinkClassName}>
							<UserIcon className="size-4" />
							{t("Members")}
						</Link>
					</li>
					<li>
						<Link to="/$slug/settings/teams" params={{ slug }} className={sidebarLinkClassName}>
							<LayersIcon className="size-4" />
							{t("Teams")}
						</Link>
					</li>
					<li>
						<Link to="/$slug/settings/billing" params={{ slug }} className={sidebarLinkClassName}>
							<CreditCardIcon className="size-4" />
							{t("Billing")}
						</Link>
					</li>
				</ul>
			</div>

			{currentTeam && teamSlug ? (
				<div className="mb-4">
					<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{currentTeam.name}</p>
					<ul className="grid gap-0.5">
						<li>
							<Link
								to="/$slug/teams/$teamSlug/settings/general"
								params={{ slug, teamSlug }}
								className={sidebarLinkClassName}
							>
								<SettingsIcon className="size-4" />
								{t("General")}
							</Link>
						</li>
						<li>
							<Link
								to="/$slug/teams/$teamSlug/settings/members"
								params={{ slug, teamSlug }}
								className={sidebarLinkClassName}
							>
								<UserIcon className="size-4" />
								{t("Members")}
							</Link>
						</li>
					</ul>
				</div>
			) : teams.length > 0 ? (
				<div className="mb-4">
					<p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{t("Teams")}</p>
					<ul className="grid gap-0.5">
						{teams.map((team) => (
							<li key={team.id}>
								<Link
									to="/$slug/teams/$teamSlug/settings/general"
									params={{ slug, teamSlug: team.slug }}
									className={sidebarLinkClassName}
								>
									<LayersIcon className="size-4" />
									{team.name}
								</Link>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</nav>
	);
}

const sidebarLinkClassName = cn(
	"flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
	"data-[active]:bg-accent data-[active]:text-accent-foreground data-[active]:font-medium",
);
