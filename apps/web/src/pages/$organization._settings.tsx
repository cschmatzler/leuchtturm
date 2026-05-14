import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { GearIcon } from "@phosphor-icons/react/Gear";
import { StackIcon } from "@phosphor-icons/react/Stack";
import { UserIcon } from "@phosphor-icons/react/User";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import type { CSSProperties } from "react";

import { Header } from "@leuchtturm/web/components/header";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@leuchtturm/web/components/ui/collapsible";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Link } from "@leuchtturm/web/components/ui/link";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@leuchtturm/web/components/ui/sidebar";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings")({
	component: Layout,
});

function Layout() {
	const { organization } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const { data: organizations } = useQuery(organizationsQuery());

	const t = useGT();

	const currentOrganization = organizations?.find((item) => item.slug === organization);

	return (
		<div className="flex h-svh flex-col">
			<Header breadcrumbs={[t("Settings")]} organization={organization} />
			<main id="main-content" className="min-h-0 grow bg-background">
				<SidebarProvider
					className="relative h-full min-h-0"
					style={{ "--sidebar-width": "15rem" } as CSSProperties}
				>
					<Sidebar variant="inset" className="absolute inset-y-0 h-full">
						<SidebarContent>
							<SidebarGroup>
								<SidebarGroupLabel>
									<T>Account</T>
								</SidebarGroupLabel>
								<SidebarGroupContent>
									<SidebarMenu>
										<SidebarMenuItem>
											<SidebarMenuButton
												render={
													<Link to="/$organization/settings/profile" params={{ organization }} />
												}
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
													<Link
														to="/$organization/settings/preferences"
														params={{ organization }}
													/>
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
								<SidebarGroupLabel>
									{currentOrganization?.name ?? <T>Organization</T>}
								</SidebarGroupLabel>
								<SidebarGroupContent>
									<SidebarMenu>
										<SidebarMenuItem>
											<SidebarMenuButton
												render={
													<Link to="/$organization/settings/members" params={{ organization }} />
												}
											>
												<UserIcon />
												<span>
													<T>Members</T>
												</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
										<SidebarMenuItem>
											<SidebarMenuButton
												render={
													<Link to="/$organization/settings/teams" params={{ organization }} />
												}
											>
												<StackIcon />
												<span>
													<T>Teams</T>
												</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
										<SidebarMenuItem>
											<SidebarMenuButton
												render={
													<Link to="/$organization/settings/billing" params={{ organization }} />
												}
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

							<Show when={teams.length > 0}>
								<SidebarGroup>
									<SidebarGroupLabel>
										<T>Teams</T>
									</SidebarGroupLabel>
									<SidebarGroupContent>
										<SidebarMenu>
											{teams.map((team) => (
												<Collapsible key={team.id}>
													<SidebarMenuItem>
														<CollapsibleTrigger
															render={<SidebarMenuButton className="group/team" />}
														>
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
							</Show>
						</SidebarContent>
						<SidebarRail />
					</Sidebar>
					<SidebarInset className="bg-background">
						<div className="mx-auto flex w-full max-w-7xl grow flex-col px-4 pt-4 pb-1 sm:px-6 sm:pt-6">
							<SidebarTrigger className="mb-4 md:hidden" />
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
			</main>
		</div>
	);
}
