import { useHotkey } from "@tanstack/react-hotkeys";
import { getRouteApi, useMatchRoute, useNavigate } from "@tanstack/react-router";
import {
	BuildingIcon,
	ChevronDownIcon,
	CogIcon,
	LayersIcon,
	LogOutIcon,
	PlusIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveLanguage } from "@leuchtturm/core/i18n";
import { OptionShiftShortcut } from "@leuchtturm/web/components/ui/kbd";
import { Link } from "@leuchtturm/web/components/ui/link";
import {
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "@leuchtturm/web/components/ui/menu";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { cn } from "@leuchtturm/web/lib/cn";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

type AppHeaderTeam = {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
};

const slugRoute = getRouteApi("/$organization");

export function AppHeader({
	slug,
	activeTeam,
}: {
	readonly slug: string;
	readonly activeTeam?: AppHeaderTeam;
}) {
	const { organizationId } = slugRoute.useRouteContext();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const [currentUser] = useZeroQuery(queries.currentUser());
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const [organizations] = useZeroQuery(queries.currentUserOrganizations());

	const { t, i18n } = useTranslation();
	const { session, deviceSessions, signOutCurrent, signOutAll, setActiveSession } = useAuth();
	const commandBar = useCommandBar();
	const currentOrganization = organizations?.find((organization) => organization.slug === slug);
	const settingsActive = Boolean(
		matchRoute({ to: "/$organization/settings", params: { organization: slug }, fuzzy: true }) ||
		matchRoute({ to: "/$organization/teams/$team/settings", fuzzy: true }),
	);

	useHotkey("Mod+K", () => commandBar.show(), { ignoreInputs: false });
	useHotkey("Alt+Shift+Q", () => {
		void signOutCurrent();
	});

	useCommandProvider(
		"account",
		async () => [
			{
				title: t("Add another account"),
				category: t("Account"),
				global: true,
				icon: PlusIcon,
				run() {
					navigate({ to: "/login" });
				},
			},
			{
				title: t("Log out"),
				category: t("Account"),
				global: true,
				icon: LogOutIcon,
				shortcut: LogOutShortcut,
				async run() {
					await signOutCurrent();
				},
			},
			{
				title: t("Log out of all accounts"),
				category: t("Account"),
				global: true,
				icon: LogOutIcon,
				disabled: (deviceSessions?.length ?? 0) < 2,
				async run() {
					await signOutAll();
				},
			},
		],
		[deviceSessions, navigate, signOutAll, signOutCurrent, t],
	);

	useCommandProvider(
		"organizations",
		async () => [
			{
				title: t("Create organization"),
				category: t("Organization"),
				global: true,
				icon: BuildingIcon,
				run() {
					navigate({ to: "/create-organization" });
				},
			},
			{
				title: t("Go to organization"),
				category: t("Organization"),
				global: true,
				icon: BuildingIcon,
				disabled: !organizations?.some((organization) => organization.slug !== slug),
				run() {
					commandBar.show("select-organization");
				},
			},
		],
		[commandBar, navigate, organizations, slug, t],
	);

	useCommandProvider(
		"select-organization",
		async () => {
			const selectableOrganizations = organizations?.filter(
				(organization) => organization.slug !== slug,
			);
			if (!selectableOrganizations) return [];

			return selectableOrganizations.map((organization) => ({
				title: t("Go to {{organization}}", { organization: organization.name }),
				value: organization.slug,
				category: t("Organization"),
				icon: BuildingIcon,
				run() {
					navigate({
						to: "/$organization/settings",
						params: { organization: organization.slug },
					});
				},
			}));
		},
		[navigate, organizations, slug, t],
	);

	useCommandProvider(
		"teams",
		async () => [
			{
				title: t("Create team"),
				category: t("Team"),
				global: true,
				icon: LayersIcon,
				run() {
					navigate({ to: "/$organization/settings/teams", params: { organization: slug } });
				},
			},
			{
				title: t("Go to team"),
				category: t("Team"),
				global: true,
				icon: LayersIcon,
				disabled: teams.length === 0,
				run() {
					commandBar.show("select-team");
				},
			},
		],
		[commandBar, navigate, slug, t, teams],
	);

	useCommandProvider(
		"select-team",
		async () =>
			teams.map((team) => ({
				title: t("Go to {{team}}", { team: team.name }),
				value: team.id,
				category: t("Team"),
				icon: LayersIcon,
				run() {
					navigate({
						to: "/$organization/teams/$team",
						params: { organization: slug, team: team.slug },
					});
				},
			})),

		[navigate, slug, t, teams],
	);

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Settings"),
				category: t("Navigation"),
				global: true,
				icon: CogIcon,
				run() {
					navigate({ to: "/$organization/settings", params: { organization: slug } });
				},
			},
			...(activeTeam
				? [
						{
							title: t("Go to Team settings"),
							category: t("Navigation"),
							global: true,
							icon: CogIcon,
							run() {
								navigate({
									to: "/$organization/teams/$team/settings/general",
									params: { organization: slug, team: activeTeam.slug },
								});
							},
						},
					]
				: []),
		],
		[activeTeam, navigate, slug, t],
	);

	useEffect(() => {
		if (!currentUser) return;

		void i18n.changeLanguage(resolveLanguage(currentUser.language));
	}, [currentUser, i18n]);

	return (
		<header className="bg-background/80 sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4 backdrop-blur-md">
			<Link
				to="/$organization"
				params={{ organization: slug }}
				aria-label="Leuchtturm"
				className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
			>
				<SparklesIcon className="size-4" />
			</Link>
			<div aria-hidden className="h-6 w-px shrink-0 bg-border" />

			<div className="flex-1" />

			<div className="ml-auto flex shrink-0 items-center gap-3">
				<Menu>
					<MenuTrigger
						render={
							<button
								type="button"
								className="inline-flex h-9 max-w-48 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<BuildingIcon className="size-4 shrink-0" />
								<span className="hidden truncate sm:inline">
									{currentOrganization?.name ?? t("Organization")}
								</span>
								<ChevronDownIcon className="size-4 shrink-0" />
							</button>
						}
					/>
					<MenuContent align="end" className="min-w-56">
						{organizations?.map((organization) => (
							<MenuCheckboxItem
								key={organization.id}
								checked={organization.slug === slug}
								onClick={() => {
									void navigate({
										to: "/$organization/settings",
										params: { organization: organization.slug },
									});
								}}
							>
								{organization.name}
							</MenuCheckboxItem>
						))}
						<MenuSeparator />
						<MenuItem
							onClick={() => {
								void navigate({ to: "/create-organization" });
							}}
						>
							<PlusIcon />
							<span>{t("Create organization")}</span>
						</MenuItem>
					</MenuContent>
				</Menu>

				<div aria-hidden className="h-6 w-px shrink-0 bg-border" />

				<Menu>
					<MenuTrigger
						render={
							<button
								type="button"
								className="inline-flex h-9 max-w-48 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<LayersIcon className="size-4 shrink-0" />
								<span className="hidden truncate sm:inline">{activeTeam?.name ?? t("Teams")}</span>
								<ChevronDownIcon className="size-4 shrink-0" />
							</button>
						}
					/>
					<MenuContent align="end" className="min-w-56">
						{teams.map((team) => (
							<MenuCheckboxItem
								key={team.id}
								checked={team.id === activeTeam?.id}
								onClick={() => {
									void navigate({
										to: "/$organization/teams/$team",
										params: { organization: slug, team: team.slug },
									});
								}}
							>
								{team.name}
							</MenuCheckboxItem>
						))}
						<MenuSeparator />
						<MenuItem
							onClick={() => {
								void navigate({
									to: "/$organization/settings/teams",
									params: { organization: slug },
								});
							}}
						>
							<PlusIcon />
							<span>{t("Create team")}</span>
						</MenuItem>
					</MenuContent>
				</Menu>

				<nav className="flex items-center gap-1">
					<Link
						to="/$organization/settings"
						params={{ organization: slug }}
						aria-label={t("Settings")}
						data-active={settingsActive ? true : undefined}
						className={settingsLinkClassName}
					>
						<CogIcon className="size-4" />
					</Link>
				</nav>
				<div aria-hidden className="h-6 w-px shrink-0 bg-border" />

				<Menu>
					<MenuTrigger
						render={
							<button
								type="button"
								aria-label={t("Account")}
								className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
							>
								<UsersIcon className="size-4" />
							</button>
						}
					/>
					<MenuContent align="end" className="min-w-64">
						<div className="px-2 py-1.5">
							<p className="text-sm font-medium">{currentUser?.name}</p>
							<p className="text-xs text-muted-foreground">{currentUser?.email}</p>
						</div>
						<MenuSeparator />
						{deviceSessions && deviceSessions.length > 1 && (
							<>
								<MenuSub>
									<MenuSubTrigger>{t("Switch account")}</MenuSubTrigger>
									<MenuSubContent>
										{deviceSessions.map((deviceSession) => (
											<MenuCheckboxItem
												key={deviceSession.session.id}
												checked={deviceSession.session.token === session?.session.token}
												onClick={() => {
													void setActiveSession(deviceSession.session.token);
												}}
											>
												{deviceSession.user.email}
											</MenuCheckboxItem>
										))}
									</MenuSubContent>
								</MenuSub>
								<MenuSeparator />
							</>
						)}
						<MenuItem
							onClick={() => {
								void navigate({ to: "/login" });
							}}
						>
							<PlusIcon />
							<span>{t("Add another account")}</span>
						</MenuItem>
						<MenuSeparator />
						<MenuItem
							onClick={() => {
								void signOutCurrent();
							}}
						>
							<LogOutIcon />
							<span>{t("Log out")}</span>
							<div className="ml-auto">
								<LogOutShortcut />
							</div>
						</MenuItem>
						{deviceSessions && deviceSessions.length > 1 && (
							<MenuItem
								onClick={() => {
									void signOutAll();
								}}
							>
								<LogOutIcon />
								<span>{t("Log out of all accounts")}</span>
							</MenuItem>
						)}
					</MenuContent>
				</Menu>
			</div>
		</header>
	);
}

function LogOutShortcut() {
	return <OptionShiftShortcut keyLabel="Q" />;
}

const settingsLinkClassName = cn(
	"inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
	"data-[active]:bg-accent data-[active]:text-accent-foreground",
);
