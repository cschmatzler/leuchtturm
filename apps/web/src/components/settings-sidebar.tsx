import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { GearIcon } from "@phosphor-icons/react/Gear";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { UserIcon } from "@phosphor-icons/react/User";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { T } from "gt-react";

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

	const currentOrganization = organizations?.find((item) => item.slug === organization);

	return (
		<Sidebar variant="inset" className="absolute inset-y-0 h-full">
			<SidebarHeader>
				<h2 className="px-2 text-sm font-semibold tracking-tight">
					<T>Settings</T>
				</h2>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>
						<T>Account</T>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/profile" params={{ organization }} />}
								>
									<UserIcon />
									<span>
										<T>Profile</T>
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={
										<Link to="/$organization/settings/preferences" params={{ organization }} />
									}
								>
									<GearIcon />
									<span>
										<T>Preferences</T>
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>{currentOrganization?.name ?? <T>Organization</T>}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/members" params={{ organization }} />}
								>
									<UserIcon />
									<span>
										<T>Members</T>
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/teams" params={{ organization }} />}
								>
									<StackIcon />
									<span>
										<T>Teams</T>
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton
									render={<Link to="/$organization/settings/billing" params={{ organization }} />}
								>
									<CreditCardIcon />
									<span>
										<T>Billing</T>
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{teams.length > 0 ? (
					<SidebarGroup>
						<SidebarGroupLabel>
							<T>Teams</T>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{teams.map((team) => (
									<Collapsible key={team.id}>
										<SidebarMenuItem>
											<CollapsibleTrigger render={<SidebarMenuButton className="group/team" />}>
												<StackIcon />
												<span>{team.name}</span>
												<CaretRightIcon className="ml-auto transition-transform group-data-[panel-open]/team:rotate-90" />
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
															<GearIcon />
															<span>
																<T>General</T>
															</span>
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
															<span>
																<T>Members</T>
															</span>
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
