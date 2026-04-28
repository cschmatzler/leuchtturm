import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ChevronRightIcon, CreditCardIcon, LayersIcon, SettingsIcon, UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leuchtturm/web/components/ui/collapsible";
import { Link } from "@leuchtturm/web/components/ui/link";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarRail,
} from "@leuchtturm/web/components/ui/sidebar";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { queries } from "@leuchtturm/zero/queries";

const organizationRoute = getRouteApi("/$organization");

export function SettingsSidebar({ organization }: { readonly organization: string }) {
	const { organizationId } = organizationRoute.useRouteContext();
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const { data: organizations } = useQuery(organizationsQuery());

	const { t } = useTranslation();

	const currentOrganization = organizations?.find((item) => item.slug === organization);

	return (
		<Sidebar variant="inset" className="absolute inset-y-0 h-full">
			<SidebarHeader>
				<h2 className="px-2 text-sm font-semibold tracking-tight">{t("Settings")}</h2>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>{t("Account")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/profile" params={{ organization }} />}
								>
									<UserIcon />
									<span>{t("Profile")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link to="/$organization/settings/preferences" params={{ organization }} />
									}
								>
									<SettingsIcon />
									<span>{t("Preferences")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>{currentOrganization?.name ?? t("Organization")}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/members" params={{ organization }} />}
								>
									<UserIcon />
									<span>{t("Members")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/teams" params={{ organization }} />}
								>
									<LayersIcon />
									<span>{t("Teams")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/billing" params={{ organization }} />}
								>
									<CreditCardIcon />
									<span>{t("Billing")}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{teams.length > 0 ? (
					<SidebarGroup>
						<SidebarGroupLabel>{t("Teams")}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{teams.map((team) => (
									<Collapsible key={team.id}>
										<SidebarMenuItem>
											<CollapsibleTrigger render={<SidebarMenuButton className="group/team" />}>
												<LayersIcon />
												<span>{team.name}</span>
												<ChevronRightIcon className="ml-auto transition-transform group-data-[panel-open]/team:rotate-90" />
											</CollapsibleTrigger>
											<CollapsibleContent>
												<SidebarMenuSub>
													<SidebarMenuSubItem>
														<SidebarMenuSubButton
															render={
																<Link
																	to="/$organization/teams/$team/settings/general"
																	params={{ organization, team: team.slug }}
																/>
															}
														>
															<SettingsIcon />
															<span>{t("General")}</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
													<SidebarMenuSubItem>
														<SidebarMenuSubButton
															render={
																<Link
																	to="/$organization/teams/$team/settings/members"
																	params={{ organization, team: team.slug }}
																/>
															}
														>
															<UserIcon />
															<span>{t("Members")}</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												</SidebarMenuSub>
											</CollapsibleContent>
										</SidebarMenuItem>
									</Collapsible>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
