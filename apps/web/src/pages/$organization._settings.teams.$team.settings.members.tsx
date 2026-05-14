import { EnvelopeIcon } from "@phosphor-icons/react/Envelope";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { ShieldIcon } from "@phosphor-icons/react/Shield";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UserIcon } from "@phosphor-icons/react/User";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { Role } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { DataTable } from "@leuchtturm/web/components/data-table";
import { filtersStateSchema } from "@leuchtturm/web/components/data-table-filter/search-params";
import {
	createTanStackColumns,
	createTanStackFilters,
} from "@leuchtturm/web/components/data-table-filter/tanstack";
import type { ColumnConfig } from "@leuchtturm/web/components/data-table-filter/types";
import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useSearchFilters } from "@leuchtturm/web/hooks/use-search-filters";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { formatRole } from "@leuchtturm/web/lib/role";
import { queries } from "@leuchtturm/zero/queries";

const ROLE_OPTIONS = Role.literals.map((role) => ({
	label: formatRole(role),
	value: role,
}));

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/members")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			tmfilters: filtersStateSchema,
			amfilters: filtersStateSchema,
		}),
	),
	search: {
		middlewares: [stripSearchParams({ tmfilters: [], amfilters: [] })],
	},
	loader: ({ context: { organizationId, zero }, params }) => {
		zero?.preload(queries.organizationMembers({ organizationId }));
		zero?.preload(queries.teamMembersByTeam({ organizationId, team: params.team }));
	},
	component: Page,
});

function Page() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<TeamMembersSection />
			<AddOrganizationMembersSection />
		</div>
	);
}

function TeamMembersSection() {
	const { team } = Route.useParams();
	const { organizationId, session } = Route.useRouteContext();

	const [currentTeam] = useZeroQuery(queries.team({ organizationId, team }));
	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(queries.teamMembersByTeam({ organizationId, team }));

	const t = useGT();

	const [searchFilters, setSearchFilters] = useSearchFilters({
		route: Route,
		key: "tmfilters",
	});

	const teamMemberFilters = useDataTableFilters({
		data: teamMembers,
		filterDefinitions: [
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
		] satisfies ColumnConfig<(typeof teamMembers)[number]>[],
		filters: searchFilters,
		onFiltersChange: setSearchFilters,
	});

	const teamMemberTable = useReactTable({
		data: teamMembers,
		columns: createTanStackColumns({
			columns: [
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
								organizationMembers.find((member) => member.userId === row.original.userId)
									?.role !== "owner"
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
			] satisfies ColumnDef<(typeof teamMembers)[number]>[],
			filterColumns: teamMemberFilters.filterColumns,
		}),
		state: { columnFilters: createTanStackFilters(teamMemberFilters.filters) },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	if (!currentTeam) return null;

	const teamId = currentTeam.id;

	async function removeMember(userId: string) {
		if (
			userId === session.user.id ||
			organizationMembers.find((member) => member.userId === userId)?.role === "owner"
		) {
			toast.error(t("This team member cannot be removed."));
			return;
		}

		const { error } = await authClient.organization.removeTeamMember({
			teamId,
			userId,
			organizationId,
		});

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success(t("Team member removed"));
	}

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

function AddOrganizationMembersSection() {
	const { team } = Route.useParams();
	const { organizationId } = Route.useRouteContext();

	const [currentTeam] = useZeroQuery(queries.team({ organizationId, team }));
	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(queries.teamMembersByTeam({ organizationId, team }));

	const t = useGT();

	const [searchFilters, setSearchFilters] = useSearchFilters({
		route: Route,
		key: "amfilters",
	});

	const availableMembers = organizationMembers.filter(
		(member) => !teamMembers.some((teamMember) => teamMember.userId === member.userId),
	);

	const availableMemberFilters = useDataTableFilters({
		data: availableMembers,
		filterDefinitions: [
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
		] satisfies ColumnConfig<(typeof availableMembers)[number]>[],
		filters: searchFilters,
		onFiltersChange: setSearchFilters,
	});

	const availableMemberTable = useReactTable({
		data: availableMembers,
		columns: createTanStackColumns({
			columns: [
				{
					id: "name",
					header: t("Name"),
					accessorFn: (member) => member.user?.name ?? member.userId,
					cell: ({ row }) => (
						<div>
							<p className="text-sm font-medium">
								{row.original.user?.name ?? row.original.userId}
							</p>
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
			] satisfies ColumnDef<(typeof availableMembers)[number]>[],
			filterColumns: availableMemberFilters.filterColumns,
		}),
		state: { columnFilters: createTanStackFilters(availableMemberFilters.filters) },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	if (!currentTeam) return null;

	const teamId = currentTeam.id;

	async function addMember(userId: string) {
		const { error } = await authClient.organization.addTeamMember({
			teamId,
			userId,
			organizationId,
		});

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success(t("Team member added"));
	}

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
