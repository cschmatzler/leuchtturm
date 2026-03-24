import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import {
	CheckIcon,
	ChevronDownIcon,
	CogIcon,
	CreditCardIcon,
	LogOutIcon,
	MailIcon,
	PlusIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveLanguage } from "@chevrotain/core/i18n";
import { Avatar, AvatarFallback } from "@chevrotain/web/components/ui/avatar";
import { renderOptionShiftShortcut } from "@chevrotain/web/components/ui/kbd";
import { Link } from "@chevrotain/web/components/ui/link";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuShortcut,
	MenuTrigger,
} from "@chevrotain/web/components/ui/menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "@chevrotain/web/components/ui/sidebar";
import { ZeroProvider, type SessionData } from "@chevrotain/web/contexts/zero";
import { useAuth } from "@chevrotain/web/hooks/use-auth";
import { useCommandBar } from "@chevrotain/web/hooks/use-command-bar";
import { useCommandProvider } from "@chevrotain/web/hooks/use-command-provider";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { deviceSessionsQuery, sessionQuery } from "@chevrotain/web/queries/session";
import { queries } from "@chevrotain/zero/queries";

const SETTINGS_NAVIGATION = [
	{
		to: "/app/settings/preferences" as const,
		icon: CogIcon,
		labelKey: "Preferences",
	},
	{
		to: "/app/settings/billing" as const,
		icon: CreditCardIcon,
		labelKey: "Billing",
	},
] as const;

export const Route = createFileRoute("/app")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.fetchQuery(sessionQuery());
		if (!session) throw redirect({ to: "/login" });
		return { session };
	},
	component: Layout,
});

function Layout() {
	const { session } = Route.useRouteContext();

	return <App session={session} />;
}

function App({ session }: { session: SessionData }) {
	return (
		<ZeroProvider key={session.user.id} session={session}>
			<Shell session={session} />
		</ZeroProvider>
	);
}

function Shell({ session }: { session: SessionData }) {
	const navigate = useNavigate();
	const { t, i18n } = useTranslation();
	const { signOut, switchSession, signOutAll } = useAuth();
	const commandBar = useCommandBar();

	const [currentUser] = useZeroQuery(queries.currentUser());
	const { data: deviceSessions } = useQuery(deviceSessionsQuery());

	useHotkey("Mod+K", () => commandBar.show(), { ignoreInputs: false });
	useHotkey("Alt+Shift+Q", () => signOut());

	useCommandProvider(
		"account",
		async () => {
			const commands = [
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
					shortcut: () => renderOptionShiftShortcut("Q"),
					async run() {
						await signOut();
					},
				},
				{
					title: t("Log out of all accounts"),
					category: t("Account"),
					global: true,
					icon: LogOutIcon,
					async run() {
						await signOutAll();
					},
				},
			];

			const switchCommands = (deviceSessions ?? [])
				.filter((ds) => ds.session.token !== session.session.token)
				.map((ds) => ({
					title: t("Switch to {{name}}", { name: ds.user.name }),
					category: t("Account"),
					global: true,
					icon: CheckIcon,
					async run() {
						await switchSession(ds.session.token);
					},
				}));

			return [...switchCommands, ...commands];
		},
		[session.session.token, deviceSessions, signOut, signOutAll, switchSession, navigate, t],
	);

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Preferences"),
				value: "navigation-preferences",
				category: t("Navigation"),
				global: true,
				icon: CogIcon,
				run() {
					navigate({ to: "/app/settings/preferences" });
				},
			},
		],
		[navigate, session.user.id, t],
	);

	useEffect(() => {
		if (!currentUser) return;

		void i18n.changeLanguage(resolveLanguage(currentUser.language));
	}, [currentUser, i18n]);

	const handleSwitchSession = async (sessionToken: string) => {
		await switchSession(sessionToken);
	};

	return (
		<SidebarProvider>
			<Sidebar variant="inset">
				<SidebarHeader>
					<div className="flex items-center gap-2.5 px-2 py-1">
						<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<MailIcon className="size-4" />
						</div>
						<span className="text-sm font-semibold">Chevrotain</span>
					</div>
				</SidebarHeader>
				<SidebarContent className="gap-0">
					<SidebarGroup>
						<SidebarGroupLabel>{t("Settings")}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{SETTINGS_NAVIGATION.map((item) => (
									<SidebarMenuItem key={item.to}>
										<SidebarMenuButton render={<Link to={item.to} />}>
											<item.icon />
											{t(item.labelKey)}
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
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
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarFallback className="rounded-lg">
											{currentUser?.name.slice(0, 1)}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{currentUser?.name}</span>
										<span className="truncate text-xs">{currentUser?.email}</span>
									</div>
									<ChevronDownIcon className="ml-auto size-4" />
								</SidebarMenuButton>
							}
						/>
						<MenuContent side="right" alignOffset={-4}>
							{deviceSessions && deviceSessions.length > 1 && (
								<>
									{deviceSessions.map((ds) => {
										const isActive = ds.session.token === session.session.token;
										return (
											<MenuItem
												key={ds.session.id}
												disabled={isActive}
												onClick={() => {
													if (!isActive) {
														handleSwitchSession(ds.session.token);
													}
												}}
											>
												<Avatar className="h-6 w-6 rounded-md">
													<AvatarFallback className="rounded-md text-xs">
														{ds.user.name.slice(0, 1)}
													</AvatarFallback>
												</Avatar>
												<div className="grid flex-1 text-left text-sm leading-tight">
													<span className="truncate font-medium">{ds.user.name}</span>
													<span className="text-muted-foreground truncate text-xs">
														{ds.user.email}
													</span>
												</div>
												{isActive && <CheckIcon className="ml-auto size-4" />}
											</MenuItem>
										);
									})}
									<MenuSeparator />
								</>
							)}
							<MenuItem onClick={() => navigate({ to: "/login" })}>
								<PlusIcon />
								<span>{t("Add another account")}</span>
							</MenuItem>
							<MenuSeparator />
							<MenuItem onClick={signOut}>
								<LogOutIcon />
								<span>{t("Log out")}</span>
								<MenuShortcut>{renderOptionShiftShortcut("Q")}</MenuShortcut>
							</MenuItem>
							{deviceSessions && deviceSessions.length > 1 && (
								<MenuItem onClick={signOutAll}>
									<LogOutIcon />
									<span>{t("Log out of all accounts")}</span>
								</MenuItem>
							)}
						</MenuContent>
					</Menu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset id="main-content">
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}
