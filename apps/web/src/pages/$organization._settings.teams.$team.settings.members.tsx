import { EnvelopeIcon, PlusIcon, ShieldIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { DataTable } from "@leuchtturm/web/components/data-table";
import {
	createTanStackColumns,
	createTanStackFilters,
} from "@leuchtturm/web/components/data-table-filter/tanstack";
import type { ColumnConfig } from "@leuchtturm/web/components/data-table-filter/types";
import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/members")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.team({ organizationId, team }));
		zero.preload(queries.organizationMembers({ organizationId }));
		zero.preload(queries.teamMembersByTeam({ organizationId, team }));
	},
	component: Page,
});

function Page() {
	const { team } = Route.useParams();

	return <MembersSettings team={team} />;
}

function MembersSettings(props: { readonly team: string }) {
	const { organizationId, session } = Route.useRouteContext();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));
	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(
		queries.teamMembersByTeam({ organizationId, team: props.team }),
	);
	const teamMemberRows = useMemo(
		() =>
			teamMembers.map((teamMember) => {
				const organizationMember = organizationMembers.find(
					(member) => member.userId === teamMember.userId,
				);
				return {
					...teamMember,
					organizationMember,
					name: organizationMember?.user?.name ?? teamMember.user?.name ?? teamMember.userId,
					email: organizationMember?.user?.email ?? teamMember.user?.email ?? "",
					role: organizationMember?.role ?? "",
				};
			}),
		[organizationMembers, teamMembers],
	);
	const teamMemberUserIds = useMemo(
		() => new Set(teamMembers.map((member) => member.userId)),
		[teamMembers],
	);
	const availableMembers = useMemo(
		() => organizationMembers.filter((member) => !teamMemberUserIds.has(member.userId)),
		[organizationMembers, teamMemberUserIds],
	);
	const roleOptions = useMemo(
		() =>
			["owner", "admin", "member"].map((role) => ({
				label: `${role.charAt(0).toUpperCase()}${role.slice(1)}`,
				value: role,
			})),
		[],
	);

	const addMember = useCallback(
		async (userId: string) => {
			if (!team) return;
			const { error } = await authClient.organization.addTeamMember({
				teamId: team.id,
				userId,
				organizationId,
			});
			if (error) throw error;
			toast.success(t("Team member added"));
		},
		[organizationId, t, team],
	);

	const removeMember = useCallback(
		async (userId: string) => {
			if (!team) return;
			if (
				userId === session.user.id ||
				organizationMembers.find((member) => member.userId === userId)?.role === "owner"
			) {
				toast.error(t("This team member cannot be removed"));
				return;
			}
			const { error } = await authClient.organization.removeTeamMember({
				teamId: team.id,
				userId,
				organizationId,
			});
			if (error) throw error;
			toast.success(t("Team member removed"));
		},
		[organizationId, organizationMembers, session.user.id, t, team],
	);

	const teamMemberColumns = useMemo<ColumnDef<(typeof teamMemberRows)[number]>[]>(
		() => [
			{
				id: "name",
				header: t("Name"),
				accessorFn: (member) => member.name,
				cell: ({ row }) => (
					<div>
						<p className="text-sm font-medium">{row.original.name}</p>
						{row.original.email && (
							<p className="text-xs text-muted-foreground">{row.original.email}</p>
						)}
					</div>
				),
			},
			{
				id: "email",
				header: t("Email"),
				accessorFn: (member) => member.email,
			},
			{
				id: "role",
				header: t("Role"),
				accessorFn: (member) => member.role,
				cell: ({ getValue }) => {
					const role = getValue<string>();
					return role ? (
						<Badge variant="outline">{`${role.charAt(0).toUpperCase()}${role.slice(1)}`}</Badge>
					) : null;
				},
			},
			{
				id: "actions",
				header: "",
				size: 1,
				cell: ({ row }) =>
					row.original.userId !== session.user.id &&
					row.original.organizationMember?.role !== "owner" ? (
						<Button
							variant="destructive"
							size="sm"
							onClick={() => void removeMember(row.original.userId)}
						>
							<TrashIcon className="size-4" />
							{t("Remove")}
						</Button>
					) : null,
			},
		],
		[removeMember, session.user.id, t],
	);
	const teamMemberFilterDefinitions = useMemo(
		() =>
			[
				{
					id: "name",
					accessor: (member) => member.name,
					displayName: t("Name"),
					icon: UserIcon,
					type: "text",
				},
				{
					id: "email",
					accessor: (member) => member.email,
					displayName: t("Email"),
					icon: EnvelopeIcon,
					type: "text",
				},
				{
					id: "role",
					accessor: (member) => member.role,
					displayName: t("Role"),
					icon: ShieldIcon,
					type: "option",
					options: roleOptions,
				},
			] satisfies ColumnConfig<(typeof teamMemberRows)[number]>[],
		[roleOptions, t],
	);
	const teamMemberFilters = useDataTableFilters({
		strategy: "client",
		data: teamMemberRows,
		filterDefinitions: teamMemberFilterDefinitions,
	});
	const teamMemberTableColumns = useMemo(
		() =>
			createTanStackColumns({
				columns: teamMemberColumns,
				filterColumns: teamMemberFilters.filterColumns,
			}),
		[teamMemberColumns, teamMemberFilters.filterColumns],
	);
	const teamMemberColumnFilters = useMemo(
		() => createTanStackFilters(teamMemberFilters.filters),
		[teamMemberFilters.filters],
	);
	const teamMemberTable = useReactTable({
		data: teamMemberRows,
		columns: teamMemberTableColumns,
		state: { columnFilters: teamMemberColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	const availableMemberColumns = useMemo<ColumnDef<(typeof availableMembers)[number]>[]>(
		() => [
			{
				id: "name",
				header: t("Name"),
				accessorFn: (member) => member.user?.name ?? member.userId,
				cell: ({ row }) => (
					<div>
						<p className="text-sm font-medium">{row.original.user?.name ?? row.original.userId}</p>
						{row.original.user?.email && (
							<p className="text-xs text-muted-foreground">{row.original.user.email}</p>
						)}
					</div>
				),
			},
			{
				id: "email",
				header: t("Email"),
				accessorFn: (member) => member.user?.email ?? "",
			},
			{
				id: "role",
				header: t("Role"),
				accessorFn: (member) => member.role,
				cell: ({ getValue }) => {
					const role = getValue<string>();
					return (
						<Badge variant="outline">{`${role.charAt(0).toUpperCase()}${role.slice(1)}`}</Badge>
					);
				},
			},
			{
				id: "actions",
				header: "",
				size: 1,
				cell: ({ row }) => (
					<Button variant="outline" size="sm" onClick={() => void addMember(row.original.userId)}>
						<PlusIcon className="size-4" />
						{t("Add")}
					</Button>
				),
			},
		],
		[addMember, t],
	);
	const availableMemberFilterDefinitions = useMemo(
		() =>
			[
				{
					id: "name",
					accessor: (member) => member.user?.name ?? member.userId,
					displayName: t("Name"),
					icon: UserIcon,
					type: "text",
				},
				{
					id: "email",
					accessor: (member) => member.user?.email ?? "",
					displayName: t("Email"),
					icon: EnvelopeIcon,
					type: "text",
				},
				{
					id: "role",
					accessor: (member) => member.role,
					displayName: t("Role"),
					icon: ShieldIcon,
					type: "option",
					options: roleOptions,
				},
			] satisfies ColumnConfig<(typeof availableMembers)[number]>[],
		[roleOptions, t],
	);
	const availableMemberFilters = useDataTableFilters({
		strategy: "client",
		data: availableMembers,
		filterDefinitions: availableMemberFilterDefinitions,
	});
	const availableMemberTableColumns = useMemo(
		() =>
			createTanStackColumns({
				columns: availableMemberColumns,
				filterColumns: availableMemberFilters.filterColumns,
			}),
		[availableMemberColumns, availableMemberFilters.filterColumns],
	);
	const availableMemberColumnFilters = useMemo(
		() => createTanStackFilters(availableMemberFilters.filters),
		[availableMemberFilters.filters],
	);
	const availableMemberTable = useReactTable({
		data: availableMembers,
		columns: availableMemberTableColumns,
		state: { columnFilters: availableMemberColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Team members")}</h2>
					<p className="text-sm text-muted-foreground">{t("Members who can access this team.")}</p>
				</div>
				<DataTable
					className="mt-5"
					table={teamMemberTable}
					filterColumns={teamMemberFilters.filterColumns}
					filters={teamMemberFilters.filters}
					actions={teamMemberFilters.actions}
					emptyIcon={UserIcon}
					emptyRowName={t("team members")}
				/>
			</section>

			{availableMembers.length > 0 && (
				<>
					<Separator />

					<section className="py-6">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold">{t("Add organization members")}</h2>
							<p className="text-sm text-muted-foreground">
								{t("Add existing organization members to this team.")}
							</p>
						</div>
						<DataTable
							className="mt-5"
							table={availableMemberTable}
							filterColumns={availableMemberFilters.filterColumns}
							filters={availableMemberFilters.filters}
							actions={availableMemberFilters.actions}
							emptyIcon={UserIcon}
							emptyRowName={t("organization members")}
						/>
					</section>
				</>
			)}
		</div>
	);
}
