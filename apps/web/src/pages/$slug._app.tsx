import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { BuildingIcon, ChevronDownIcon, CogIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveLanguage } from "@leuchtturm/core/i18n";
import { Avatar, AvatarFallback } from "@leuchtturm/web/components/ui/avatar";
import { OptionShiftShortcut } from "@leuchtturm/web/components/ui/kbd";
import { Link } from "@leuchtturm/web/components/ui/link";
import {
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuGroup,
	MenuItem,
	MenuLabel,
	MenuSeparator,
	MenuSub,
	MenuSubContent,
	MenuSubTrigger,
	MenuTrigger,
} from "@leuchtturm/web/components/ui/menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "@leuchtturm/web/components/ui/sidebar";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { deviceSessionsQuery } from "@leuchtturm/web/queries/device-sessions";
import { queries } from "@leuchtturm/zero/queries";

function LogOutShortcut() {
	return <OptionShiftShortcut keyLabel="Q" />;
}

export const Route = createFileRoute("/$slug/_app")({
	component: Layout,
});

function Layout() {
	return <Shell />;
}

function Shell() {
	const { slug } = Route.useParams();
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const { signOutCurrent, signOutAll } = useAuth();
	const commandBar = useCommandBar();

	const [currentUser] = useZeroQuery(queries.currentUser());
	useZeroQuery(queries.organization({ slug }));
	const { data: deviceSessions } = useQuery(deviceSessionsQuery());

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
				disabled: (deviceSessions?.sessions.length ?? 0) < 2,
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
				disabled: !deviceSessions?.organizations.some((organization) => organization.slug !== slug),
				run() {
					commandBar.show("select-organization");
				},
			},
		],
		[commandBar, deviceSessions, navigate, slug, t],
	);

	useCommandProvider(
		"select-organization",
		async () => {
			const organizations = deviceSessions?.organizations.filter(
				(organization) => organization.slug !== slug,
			);
			if (!organizations) return [];

			return organizations.map((organization) => ({
				title: t("Go to {{organization}}", { organization: organization.name }),
				value: organization.slug,
				category: t("Organization"),
				icon: BuildingIcon,
				run() {
					navigate({
						to: "/$slug/settings/preferences",
						params: { slug: organization.slug },
					});
				},
			}));
		},
		[deviceSessions, navigate, slug, t],
	);

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Preferences"),
				category: t("Navigation"),
				global: true,
				icon: CogIcon,
				run() {
					navigate({ to: "/$slug/settings/preferences", params: { slug } });
				},
			},
		],
		[navigate, slug, t],
	);

	useEffect(() => {
		if (!currentUser) return;

		void i18n.changeLanguage(resolveLanguage(currentUser.language));
	}, [currentUser, i18n]);

	return (
		<SidebarProvider open={false}>
			<Sidebar variant="inset" collapsible="icon">
				<SidebarHeader>
					<Menu>
						<MenuTrigger
							render={
								<SidebarMenuButton className="inline-flex justify-between">
									<BuildingIcon className="size-4" />
									<ChevronDownIcon className="size-4" />
								</SidebarMenuButton>
							}
						/>
						<MenuContent side="right" align="start">
							<MenuSub>
								<MenuSubTrigger>{t("Change organization")}</MenuSubTrigger>
								<MenuSubContent>
									{deviceSessions?.sessions.map((deviceSession) => (
										<MenuGroup key={deviceSession.session.id}>
											<MenuLabel className="text-muted-foreground text-xs">
												{deviceSession.user.email}
											</MenuLabel>
											{deviceSession.organizations.map((organization) => (
												<MenuCheckboxItem
													key={organization.id}
													checked={organization.slug === slug}
													onClick={() => {
														void navigate({
															to: "/$slug/settings/preferences",
															params: { slug: organization.slug },
														});
													}}
												>
													{organization.name}
												</MenuCheckboxItem>
											))}
										</MenuGroup>
									))}
								</MenuSubContent>
							</MenuSub>
							<MenuSeparator />
							<MenuItem
								onClick={() => {
									void navigate({ to: "/create-organization" });
								}}
							>
								{t("Create organization")}
							</MenuItem>
						</MenuContent>
					</Menu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										tooltip={t("Settings")}
										render={<Link to="/$slug/settings" params={{ slug }} />}
									>
										<CogIcon />
										<span>{t("Settings")}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
				<SidebarFooter>
					<Menu>
						<MenuTrigger
							render={
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="size-8 rounded-lg">
										<AvatarFallback className="rounded-lg">
											{currentUser?.name.slice(0, 1)}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{currentUser?.name}</span>
										<span className="truncate text-xs">{currentUser?.email}</span>
									</div>
								</SidebarMenuButton>
							}
						/>
						<MenuContent side="right" align="end">
							<div className="px-2 py-1.5">
								<p className="text-sm font-medium">{currentUser?.name}</p>
								<p className="text-xs text-muted-foreground">{currentUser?.email}</p>
							</div>
							<MenuSeparator />
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
							{deviceSessions && deviceSessions.sessions.length > 1 && (
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
				</SidebarFooter>
			</Sidebar>
			<SidebarInset id="main-content">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
