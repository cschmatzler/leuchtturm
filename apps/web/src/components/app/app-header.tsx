import {
	ArrowFatUpIcon,
	CaretDownIcon,
	GearIcon,
	SignOutIcon,
	OptionIcon,
	PlusIcon,
	SparkleIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveLanguage } from "@leuchtturm/core/i18n";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@leuchtturm/web/components/ui/breadcrumb";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@leuchtturm/web/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@leuchtturm/web/components/ui/kbd";
import { Link } from "@leuchtturm/web/components/ui/link";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { queries } from "@leuchtturm/zero/queries";

export function AppHeader({
	organization,
	team,
}: {
	readonly organization: string;
	readonly team?: string;
}) {
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const [currentUser] = useZeroQuery(queries.currentUser());
	const [currentOrganization] = useZeroQuery(queries.organization({ organization }));
	const { data: organizations } = useQuery(organizationsQuery());

	const { t, i18n } = useTranslation();
	const { session, deviceSessions, signOutCurrent, signOutAll, setActiveSession } = useAuth();
	const teams = currentOrganization?.teams ?? [];
	const activeTeam = team ? teams.find((item) => item.slug === team) : undefined;
	const settingsActive = Boolean(
		matchRoute({ to: "/$organization/settings", params: { organization }, fuzzy: true }) ||
		matchRoute({ to: "/$organization/teams/$team/settings", fuzzy: true }),
	);

	useEffect(() => {
		if (!currentUser) return;

		void i18n.changeLanguage(resolveLanguage(currentUser.language));
	}, [currentUser, i18n]);

	return (
		<header className="bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4 backdrop-blur-md">
			<Link
				to="/$organization"
				params={{ organization }}
				aria-label="Leuchtturm"
				className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
			>
				<SparkleIcon className="size-4" />
			</Link>
			<div aria-hidden className="h-6 w-px shrink-0 bg-border" />

			<Breadcrumb aria-label={t("Workspace")} className="min-w-0">
				<BreadcrumbList className="flex-nowrap gap-1 sm:gap-1">
					<BreadcrumbItem>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<BreadcrumbLink
										render={<button type="button" />}
										className="inline-flex max-w-48 items-center gap-1 text-foreground"
									>
										<span className="truncate">
											{currentOrganization?.name ?? t("Organization")}
										</span>
										<CaretDownIcon className="size-4 shrink-0" />
									</BreadcrumbLink>
								}
							/>
							<DropdownMenuContent align="start" className="min-w-56">
								{organizations?.map((item) => (
									<DropdownMenuCheckboxItem
										key={item.id}
										checked={item.slug === organization}
										onClick={() => {
											void navigate({
												to: "/$organization/settings",
												params: { organization: item.slug },
											});
										}}
									>
										{item.name}
									</DropdownMenuCheckboxItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => {
										void navigate({ to: "/create-organization" });
									}}
								>
									<PlusIcon />
									<span>{t("Create organization")}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</BreadcrumbItem>

					{activeTeam && (
						<>
							<BreadcrumbSeparator />

							<BreadcrumbItem>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<BreadcrumbLink
												render={<button type="button" />}
												className="inline-flex max-w-48 items-center gap-1 text-foreground"
											>
												<span className="truncate">{activeTeam.name}</span>
												<CaretDownIcon className="size-4 shrink-0" />
											</BreadcrumbLink>
										}
									/>
									<DropdownMenuContent align="start" className="min-w-56">
										{teams.map((team) => (
											<DropdownMenuCheckboxItem
												key={team.id}
												checked={team.id === activeTeam.id}
												onClick={() => {
													void navigate({
														to: "/$organization/teams/$team",
														params: { organization, team: team.slug },
													});
												}}
											>
												{team.name}
											</DropdownMenuCheckboxItem>
										))}
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => {
												void navigate({
													to: "/$organization/settings/teams",
													params: { organization },
													search: { create: true },
												});
											}}
										>
											<PlusIcon />
											<span>{t("Create team")}</span>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</BreadcrumbItem>
						</>
					)}
				</BreadcrumbList>
			</Breadcrumb>

			<div className="flex-1" />

			<div className="ml-auto flex shrink-0 items-center gap-2">
				<nav className="flex items-center gap-1">
					<Link
						to="/$organization/settings"
						params={{ organization }}
						aria-label={t("Settings")}
						data-active={settingsActive ? true : undefined}
						className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[active]:bg-accent data-[active]:text-accent-foreground"
					>
						<GearIcon className="size-4" />
					</Link>
				</nav>

				<div aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<button
								type="button"
								aria-label={t("Account")}
								className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<UserIcon className="size-4" />
							</button>
						}
					/>
					<DropdownMenuContent align="end" className="min-w-64">
						<div className="px-2 py-1.5">
							<p className="text-sm font-medium">{currentUser?.name}</p>
							<p className="text-xs text-muted-foreground">{currentUser?.email}</p>
						</div>
						<DropdownMenuSeparator />
						{deviceSessions && deviceSessions.length > 1 && (
							<>
								<DropdownMenuSub>
									<DropdownMenuSubTrigger>{t("Switch account")}</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										{deviceSessions.map((deviceSession) => (
											<DropdownMenuCheckboxItem
												key={deviceSession.session.id}
												checked={deviceSession.session.token === session?.session.token}
												onClick={() => {
													void setActiveSession(deviceSession.session.token);
												}}
											>
												{deviceSession.user.email}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuSubContent>
								</DropdownMenuSub>
								<DropdownMenuSeparator />
							</>
						)}
						<DropdownMenuItem
							onClick={() => {
								void navigate({ to: "/login" });
							}}
						>
							<PlusIcon />
							<span>{t("Add another account")}</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => {
								void signOutCurrent();
							}}
						>
							<SignOutIcon />
							<span>{t("Log out")}</span>
							<div className="ml-auto">
								<KbdGroup>
									<Kbd>
										{/Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? (
											<OptionIcon className="size-3" />
										) : (
											"Alt"
										)}
									</Kbd>
									<Kbd>
										<ArrowFatUpIcon className="size-3" />
									</Kbd>
									<Kbd>Q</Kbd>
								</KbdGroup>
							</div>
						</DropdownMenuItem>
						{deviceSessions && deviceSessions.length > 1 && (
							<DropdownMenuItem
								onClick={() => {
									void signOutAll();
								}}
							>
								<SignOutIcon />
								<span>{t("Log out of all accounts")}</span>
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
