import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Outlet,
	redirect,
	RouterContextProvider,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { AutumnProvider, useCustomer } from "autumn-js/react";
import {
	CheckIcon,
	ChevronDownIcon,
	CogIcon,
	CreditCardIcon,
	LogOutIcon,
	PlusIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Loading } from "@one/web/components/app/loading";
import { Avatar, AvatarFallback } from "@one/web/components/ui/avatar";
import { renderOptionShiftShortcut } from "@one/web/components/ui/kbd";
import { Link } from "@one/web/components/ui/link";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuShortcut,
	MenuTrigger,
} from "@one/web/components/ui/menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
} from "@one/web/components/ui/sidebar";
import { ZeroProvider, type SessionData } from "@one/web/contexts/zero";
import { useAuth } from "@one/web/hooks/use-auth";
import { useCommandBar } from "@one/web/hooks/use-command-bar";
import { useCommandProvider } from "@one/web/hooks/use-command-provider";
import { useZeroQuery } from "@one/web/lib/query";
import { deviceSessionsQuery, sessionQuery } from "@one/web/queries/session";
import { queries } from "@one/zero/queries";

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
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });
		return { session };
	},
	component: Layout,
});

function Layout() {
	const { session } = Route.useRouteContext();

	return (
		<AutumnProvider key={session.user.id} backendUrl={import.meta.env.VITE_BASE_URL} includeCredentials>
			<App session={session} />
		</AutumnProvider>
	);
}

function App({ session }: { session: SessionData }) {
	const router = useRouter();
	const { refetch, isLoading, error } = useCustomer();

	if (isLoading || Boolean(error)) return <Loading />;

	return (
		<RouterContextProvider router={router} context={{ refetch }}>
			<ZeroProvider key={session.user.id} session={session}>
				<Shell session={session} />
			</ZeroProvider>
		</RouterContextProvider>
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

		i18n.changeLanguage(currentUser.language);
	}, [currentUser, i18n]);

	const handleSwitchSession = async (sessionToken: string) => {
		await switchSession(sessionToken);
	};

	return (
		<SidebarProvider>
			<Sidebar>
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
							<MenuItem
								onClick={() => navigate({ to: "/login" })}
							>
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
