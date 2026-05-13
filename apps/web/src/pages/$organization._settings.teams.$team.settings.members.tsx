import { EnvelopeIcon } from "@phosphor-icons/react/Envelope";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { ShieldIcon } from "@phosphor-icons/react/Shield";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UserIcon } from "@phosphor-icons/react/User";
import { createFileRoute } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import { T, useGT } from "gt-react";
import { useCallback, useMemo } from "react";
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
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/members")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero?.preload(queries.team({ organizationId, team }));
		zero?.preload(queries.organizationMembers({ organizationId }));
		zero?.preload(queries.teamMembersByTeam({ organizationId, team }));
	},
	component: Page,
});

function Page() {
	const { team } = Route.useParams();

	return <MembersSettings team={team} />;
}

function MembersSettings(props: { readonly team: string }) {
	const { organizationId, session } = Route.useRouteContext();

	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));
	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(
		queries.teamMembersByTeam({ organizationId, team: props.team }),
	);

	const t = useGT();

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
						<Show when={row.original.email}>
							{(email) => <p className="text-xs text-muted-foreground">{email}</p>}
						</Show>
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
					return (
						<Show when={role}>
							{(value) => (
								<Badge variant="outline">{`${value.charAt(0).toUpperCase()}${value.slice(1)}`}</Badge>
							)}
						</Show>
					);
				},
			},
			{
				id: "actions",
				header: "",
				size: 1,
				cell: ({ row }) => (
					<Show
						when={
							row.original.userId !== session.user.id &&
							row.original.organizationMember?.role !== "owner"
						}
					>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => void removeMember(row.original.userId)}
						>
							<TrashIcon className="size-4" />
							<T>Remove</T>
						</Button>
					</Show>
				),
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
						<Show when={row.original.user?.email}>
							{(email) => <p className="text-xs text-muted-foreground">{email}</p>}
						</Show>
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
						<T>Add</T>
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
					<h2 className="font-display text-2xl">
						<T>Team members</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Members who can access this team.</T>
					</p>
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

			<Show when={availableMembers.length > 0}>
				<>
					<Separator />

					<section className="py-6">
						<div className="space-y-1">
							<h2 className="font-display text-2xl">
								<T>Add organization members</T>
							</h2>
							<p className="text-sm text-muted-foreground">
								<T>Add existing organization members to this team.</T>
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
			</Show>
		</div>
	);
}
