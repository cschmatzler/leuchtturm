import { EnvelopeIcon } from "@phosphor-icons/react/Envelope";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { ShieldIcon } from "@phosphor-icons/react/Shield";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UserIcon } from "@phosphor-icons/react/User";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { Role } from "@leuchtturm/core/auth/schema";
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
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

const ROLE_OPTIONS = Role.literals.map((role) => ({
	label: `${role.charAt(0).toUpperCase()}${role.slice(1)}`,
	value: role,
}));

const formatRole = (role: string) => `${role.charAt(0).toUpperCase()}${role.slice(1)}`;

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/members")({
	loader: async ({ context: { organizationId, zero }, params: { organization, team } }) => {
		if (!zero) return;

		const teamQuery = queries.team({ organizationId, team });
		zero.preload(teamQuery);
		zero.preload(queries.organizationMembers({ organizationId }));
		zero.preload(queries.teamMembersByTeam({ organizationId, team }));

		const currentTeam = await zero.run(teamQuery);
		if (!currentTeam) {
			throw redirect({
				to: "/$organization/settings/teams",
				params: { organization },
			});
		}
	},
	component: Page,
});

function Page() {
	const { team: teamSlug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	const [team] = useZeroQuery(queries.team({ organizationId, team: teamSlug }));

	if (!team) return null;

	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<TeamMembersSection teamId={team.id} teamSlug={teamSlug} />
			<AddOrganizationMembersSection teamId={team.id} teamSlug={teamSlug} />
		</div>
	);
}

function TeamMembersSection(props: { readonly teamId: string; readonly teamSlug: string }) {
	const { organizationId, session } = Route.useRouteContext();

	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(
		queries.teamMembersByTeam({ organizationId, team: props.teamSlug }),
	);

	const t = useGT();

	const removeMember = async (userId: string) => {
		if (
			userId === session.user.id ||
			organizationMembers.find((member) => member.userId === userId)?.role === "owner"
		) {
			toast.error(t("This team member cannot be removed"));
			return;
		}
		const { error } = await authClient.organization.removeTeamMember({
			teamId: props.teamId,
			userId,
			organizationId,
		});
		if (error) {
			toast.error(error.message);
			return;
		}
		toast.success(t("Team member removed"));
	};

	const teamMemberColumns = [
		{
			id: "name",
			header: t("Name"),
			accessorFn: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.user?.name ??
				member.user?.name ??
				member.userId,
			cell: ({ row }) => {
				const organizationMember = organizationMembers.find(
					(member) => member.userId === row.original.userId,
				);
				return (
					<div>
						<p className="text-sm font-medium">
							{organizationMember?.user?.name ?? row.original.user?.name ?? row.original.userId}
						</p>
						<Show when={organizationMember?.user?.email ?? row.original.user?.email}>
							{(email) => <p className="text-xs text-muted-foreground">{email}</p>}
						</Show>
					</div>
				);
			},
		},
		{
			id: "email",
			header: t("Email"),
			accessorFn: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.user?.email ??
				member.user?.email ??
				"",
		},
		{
			id: "role",
			header: t("Role"),
			accessorFn: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.role ?? "",
			cell: ({ getValue }) => (
				<Show when={getValue<string>()}>
					{(role) => <Badge variant="outline">{formatRole(role)}</Badge>}
				</Show>
			),
		},
		{
			id: "actions",
			header: "",
			size: 1,
			cell: ({ row }) => (
				<Show
					when={
						row.original.userId !== session.user.id &&
						organizationMembers.find((member) => member.userId === row.original.userId)?.role !==
							"owner"
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
	] satisfies ColumnDef<(typeof teamMembers)[number]>[];
	const teamMemberFilterDefinitions = [
		{
			id: "name",
			accessor: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.user?.name ??
				member.user?.name ??
				member.userId,
			displayName: t("Name"),
			icon: UserIcon,
			type: "text",
		},
		{
			id: "email",
			accessor: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.user?.email ??
				member.user?.email ??
				"",
			displayName: t("Email"),
			icon: EnvelopeIcon,
			type: "text",
		},
		{
			id: "role",
			accessor: (member) =>
				organizationMembers.find(
					(organizationMember) => organizationMember.userId === member.userId,
				)?.role ?? "",
			displayName: t("Role"),
			icon: ShieldIcon,
			type: "option",
			options: ROLE_OPTIONS,
		},
	] satisfies ColumnConfig<(typeof teamMembers)[number]>[];
	const teamMemberFilters = useDataTableFilters({
		data: teamMembers,
		filterDefinitions: teamMemberFilterDefinitions,
	});
	const teamMemberTableColumns = createTanStackColumns({
		columns: teamMemberColumns,
		filterColumns: teamMemberFilters.filterColumns,
	});
	const teamMemberColumnFilters = createTanStackFilters(teamMemberFilters.filters);
	const teamMemberTable = useReactTable({
		data: teamMembers,
		columns: teamMemberTableColumns,
		state: { columnFilters: teamMemberColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<section>
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
	);
}

function AddOrganizationMembersSection(props: {
	readonly teamId: string;
	readonly teamSlug: string;
}) {
	const { organizationId } = Route.useRouteContext();

	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(
		queries.teamMembersByTeam({ organizationId, team: props.teamSlug }),
	);

	const t = useGT();

	const availableMembers = organizationMembers.filter(
		(member) => !teamMembers.some((teamMember) => teamMember.userId === member.userId),
	);

	const addMember = async (userId: string) => {
		const { error } = await authClient.organization.addTeamMember({
			teamId: props.teamId,
			userId,
			organizationId,
		});
		if (error) {
			toast.error(error.message);
			return;
		}
		toast.success(t("Team member added"));
	};

	const availableMemberColumns = [
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
			cell: ({ getValue }) => <Badge variant="outline">{formatRole(getValue<string>())}</Badge>,
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
	] satisfies ColumnDef<(typeof availableMembers)[number]>[];
	const availableMemberFilterDefinitions = [
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
			options: ROLE_OPTIONS,
		},
	] satisfies ColumnConfig<(typeof availableMembers)[number]>[];
	const availableMemberFilters = useDataTableFilters({
		data: availableMembers,
		filterDefinitions: availableMemberFilterDefinitions,
	});
	const availableMemberTableColumns = createTanStackColumns({
		columns: availableMemberColumns,
		filterColumns: availableMemberFilters.filterColumns,
	});
	const availableMemberColumnFilters = createTanStackFilters(availableMemberFilters.filters);
	const availableMemberTable = useReactTable({
		data: availableMembers,
		columns: availableMemberTableColumns,
		state: { columnFilters: availableMemberColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<Show when={availableMembers.length > 0}>
			<section>
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
		</Show>
	);
}
