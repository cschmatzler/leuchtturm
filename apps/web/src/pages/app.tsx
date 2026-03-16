import {
	createFileRoute,
	Outlet,
	redirect,
	RouterContextProvider,
	useRouter,
} from "@tanstack/react-router";
import { AutumnProvider, useCustomer } from "autumn-js/react";
import { ChevronDownIcon, CogIcon, CreditCardIcon, LogOutIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Loading } from "@one/web/components/app/loading";
import { Avatar, AvatarFallback } from "@one/web/components/ui/avatar";
import { Link } from "@one/web/components/ui/link";
import {
	Menu,
	MenuContent,
	MenuItem,
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
import { useZeroQuery } from "@one/web/lib/query";
import { renderOptionShiftShortcut } from "@one/web/pages/app/-hooks/shortcut-kbd";
import { useAccountCommands } from "@one/web/pages/app/-hooks/use-account-commands";
import { useNavigationCommands } from "@one/web/pages/app/-hooks/use-navigation-commands";
import { useShellShortcuts } from "@one/web/pages/app/-hooks/use-shell-shortcuts";
import { sessionQuery } from "@one/web/queries/session";
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
		<AutumnProvider backendUrl={import.meta.env.VITE_BASE_URL} includeCredentials>
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
			<ZeroProvider session={session}>
				<Shell session={session} />
			</ZeroProvider>
		</RouterContextProvider>
	);
}

function Shell({ session }: { session: SessionData }) {
	const { t, i18n } = useTranslation();
	const { signOut } = useAuth();
	const commandBar = useCommandBar();

	const [currentUser] = useZeroQuery(queries.currentUser());

	useShellShortcuts({ onOpenCommandBar: commandBar.show, onSignOut: signOut });
	useAccountCommands({ userId: session.user.id, t, onSignOut: signOut });
	useNavigationCommands({ userId: session.user.id, t });

	useEffect(() => {
		if (!currentUser) return;

		i18n.changeLanguage(currentUser.language);
	}, [currentUser, i18n]);

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
							<MenuItem onClick={signOut}>
								<LogOutIcon />
								<span>{t("Logout")}</span>
								<MenuShortcut>{renderOptionShiftShortcut("Q")}</MenuShortcut>
							</MenuItem>
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
