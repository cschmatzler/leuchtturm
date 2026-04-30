import { BuildingIcon, GearIcon, StackIcon, SignOutIcon, PlusIcon } from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";
import { useCommandProvider } from "@leuchtturm/web/hooks/use-command-provider";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";

export function OrganizationCommands() {
	const { organization } = useParams({ from: "/$organization" });
	const navigate = useNavigate();
	const { data: organizations } = useQuery(organizationsQuery());
	const { t } = useTranslation();
	const { deviceSessions, signOutCurrent, signOutAll } = useAuth();
	const commandBar = useCommandBar();

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
				icon: SignOutIcon,
				async run() {
					await signOutCurrent();
				},
			},
			{
				title: t("Log out of all accounts"),
				category: t("Account"),
				global: true,
				icon: SignOutIcon,
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
				disabled: !organizations?.some((item) => item.slug !== organization),
				run() {
					commandBar.show("select-organization");
				},
			},
		],
		[commandBar, navigate, organizations, organization, t],
	);

	useCommandProvider(
		"select-organization",
		async () => {
			const selectableOrganizations = organizations?.filter((item) => item.slug !== organization);
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
		[navigate, organizations, organization, t],
	);

	useCommandProvider(
		"teams",
		async () => [
			{
				title: t("Create team"),
				category: t("Team"),
				global: true,
				icon: StackIcon,
				run() {
					navigate({
						to: "/$organization/settings/teams",
						params: { organization },
						search: { create: true },
					});
				},
			},
		],
		[navigate, organization, t],
	);

	useCommandProvider(
		"navigation",
		async () => [
			{
				title: t("Go to Settings"),
				category: t("Navigation"),
				global: true,
				icon: GearIcon,
				run() {
					navigate({ to: "/$organization/settings", params: { organization } });
				},
			},
		],
		[navigate, organization, t],
	);

	return null;
}
