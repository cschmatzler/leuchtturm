import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";
import { DotsThreeIcon } from "@phosphor-icons/react/DotsThree";
import { EnvelopeIcon } from "@phosphor-icons/react/Envelope";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { TrashIcon } from "@phosphor-icons/react/Trash";
import { UserCircleGearIcon } from "@phosphor-icons/react/UserCircleGear";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { XCircleIcon } from "@phosphor-icons/react/XCircle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, stripSearchParams } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import * as Schema from "effect/Schema";
import { T, useGT, Var } from "gt-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { DataTable } from "@leuchtturm/web/components/data-table";
import { filtersStateSchema } from "@leuchtturm/web/components/data-table-filter/search-params";
import {
	createTanStackColumns,
	createTanStackFilters,
} from "@leuchtturm/web/components/data-table-filter/tanstack";
import type { ColumnConfig } from "@leuchtturm/web/components/data-table-filter/types";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@leuchtturm/web/components/ui/alert-dialog";
import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leuchtturm/web/components/ui/dropdown-menu";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { ZeroProvider } from "@leuchtturm/web/contexts/zero";
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useSearchFilters } from "@leuchtturm/web/hooks/use-search-filters";
import { adminUsersQuery, type AdminUser } from "@leuchtturm/web/queries/admin-users";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/admin/users")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			filters: filtersStateSchema,
		}),
	),
	search: {
		middlewares: [stripSearchParams({ filters: [] })],
	},
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) {
			throw redirect({ to: "/login" });
		}

		const role = "role" in session.user ? session.user.role : undefined;
		if (role !== "admin") throw redirect({ to: "/app" });
	},
	component: Page,
});

function Page() {
	const { data: session } = useQuery(sessionQuery());

	if (!session) return null;

	return (
		<ZeroProvider session={session} storageKey="admin">
			<AdminUsersPage />
		</ZeroProvider>
	);
}

function AdminUsersPage() {
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQuery());
	const { data: users = [] } = useQuery(adminUsersQuery());
	const [searchFilters, setSearchFilters] = useSearchFilters({ route: Route });

	const t = useGT();

	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

	const total = users.length;
	const currentUserId = session?.user.id;
	const deleteUserName = deleteUser?.name ?? deleteUser?.email ?? "";

	const runUserAction = useCallback(
		async (
			key: string,
			action: () => Promise<{ error?: { message?: string } | null }>,
			success: string,
		) => {
			setPendingAction(key);

			try {
				const { error } = await action();

				if (error) {
					toast.error(error.message ?? t("Admin action failed."));
					return;
				}

				await queryClient.invalidateQueries({ queryKey: adminUsersQuery().queryKey });
				toast.success(success);
			} catch (error) {
				const message =
					typeof error === "object" && error !== null && "message" in error
						? String(error.message)
						: t("Admin action failed.");

				toast.error(message);
			} finally {
				setPendingAction(null);
			}
		},
		[queryClient, t],
	);

	const roleOptions = useMemo(
		() => [
			{ label: t("Admin"), value: "admin" },
			{ label: t("User"), value: "user" },
		],
		[t],
	);
	const statusOptions = useMemo(
		() => [
			{ label: t("Active"), value: "active" },
			{ label: t("Banned"), value: "banned" },
		],
		[t],
	);

	const columns = useMemo<ColumnDef<AdminUser>[]>(
		() => [
			{
				id: "name",
				header: t("User"),
				accessorFn: (user) => user.name,
				cell: ({ row }) => (
					<div className="flex items-center gap-3">
						<div className="flex size-8 items-center justify-center rounded-full bg-muted">
							<UserCircleGearIcon className="size-4 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">{row.original.name}</p>
							<p className="text-muted-foreground">{row.original.email}</p>
						</div>
					</div>
				),
			},
			{
				id: "email",
				header: t("Email"),
				accessorFn: (user) => user.email,
			},
			{
				id: "role",
				header: t("Role"),
				accessorFn: (user) => user.role ?? "user",
				cell: ({ getValue }) => {
					const role = getValue<string>();
					return <Badge variant={role === "admin" ? "default" : "outline"}>{role}</Badge>;
				},
			},
			{
				id: "status",
				header: t("Status"),
				accessorFn: (user) => (user.banned ? "banned" : "active"),
				cell: ({ getValue }) => {
					const status = getValue<string>();
					return (
						<Badge variant={status === "banned" ? "destructive" : "outline"}>
							<Show when={status === "banned"} fallback={<T>Active</T>}>
								<T>Banned</T>
							</Show>
						</Badge>
					);
				},
			},
			{
				id: "createdAt",
				header: t("Created"),
				accessorFn: (user) => new Date(user.createdAt),
				cell: ({ getValue }) => (
					<p className="text-muted-foreground">{getValue<Date>().toLocaleDateString()}</p>
				),
			},
			{
				id: "actions",
				header: "",
				enableColumnFilter: false,
				size: 40,
				cell: ({ row }) => (
					<UserActions
						user={row.original}
						currentUserId={currentUserId}
						pendingAction={pendingAction}
						setDeleteUser={setDeleteUser}
						runUserAction={runUserAction}
					/>
				),
			},
		],
		[currentUserId, pendingAction, runUserAction, t],
	);
	const filterDefinitions = useMemo(
		() =>
			[
				{
					id: "name",
					accessor: (user) => user.name,
					displayName: t("Name"),
					icon: UserCircleGearIcon,
					type: "text",
				},
				{
					id: "email",
					accessor: (user) => user.email,
					displayName: t("Email"),
					icon: EnvelopeIcon,
					type: "text",
				},
				{
					id: "role",
					accessor: (user) => user.role ?? "user",
					displayName: t("Role"),
					icon: ShieldCheckIcon,
					type: "option",
					options: roleOptions,
				},
				{
					id: "status",
					accessor: (user) => (user.banned ? "banned" : "active"),
					displayName: t("Status"),
					icon: XCircleIcon,
					type: "option",
					options: statusOptions,
				},
				{
					id: "createdAt",
					accessor: (user) => new Date(user.createdAt),
					displayName: t("Created"),
					icon: ArrowRightIcon,
					type: "date",
				},
			] satisfies ColumnConfig<AdminUser>[],
		[roleOptions, statusOptions, t],
	);
	const filters = useDataTableFilters({
		data: users,
		filterDefinitions,
		filters: searchFilters,
		onFiltersChange: setSearchFilters,
	});
	const tableColumns = useMemo(
		() => createTanStackColumns({ columns, filterColumns: filters.filterColumns }),
		[columns, filters.filterColumns],
	);
	const columnFilters = useMemo(() => createTanStackFilters(filters.filters), [filters.filters]);
	const table = useReactTable({
		data: users,
		columns: tableColumns,
		state: { columnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	return (
		<main className="min-h-svh bg-background px-4 py-6 sm:px-6 lg:px-8">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<ShieldCheckIcon className="size-4" />
							<T>Admin</T>
						</div>
						<div>
							<h1 className="font-serif text-2xl tracking-tight">
								<T>User management</T>
							</h1>
							<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
								<T>Review accounts, adjust application roles, and disable access when needed.</T>
							</p>
						</div>
					</div>
					<div className="rounded-lg border bg-card px-3 py-2 text-sm">
						<span className="text-muted-foreground">
							<T>Total users</T>
						</span>
						<span className="ml-2 font-semibold">{total}</span>
					</div>
				</header>

				<Card>
					<CardHeader>
						<CardTitle>
							<T>Accounts</T>
						</CardTitle>
						<CardDescription>
							<T>Filter accounts and manage global access.</T>
						</CardDescription>
					</CardHeader>
					<CardContent>
						<DataTable
							table={table}
							filterColumns={filters.filterColumns}
							filters={filters.filters}
							actions={filters.actions}
							emptyIcon={UsersThreeIcon}
							emptyRowName={t("users")}
						/>
					</CardContent>
				</Card>

				<AlertDialog
					open={deleteUser !== null}
					onOpenChange={(open) => !open && setDeleteUser(null)}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogMedia>
								<TrashIcon className="size-4" />
							</AlertDialogMedia>
							<AlertDialogTitle>
								<T>Delete user?</T>
							</AlertDialogTitle>
							<AlertDialogDescription>
								<T>
									This permanently removes <Var>{deleteUserName}</Var> and their sessions.
								</T>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>
								<T>Cancel</T>
							</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								disabled={!deleteUser}
								onClick={() => {
									if (!deleteUser) return;
									const userId = deleteUser.id;
									setDeleteUser(null);
									runUserAction(
										`delete:${userId}`,
										() => authClient.admin.removeUser({ userId }),
										t("User deleted"),
									);
								}}
							>
								<T>Delete</T>
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</main>
	);
}

function UserActions({
	user,
	currentUserId,
	pendingAction,
	setDeleteUser,
	runUserAction,
}: {
	user: AdminUser;
	currentUserId?: string;
	pendingAction: string | null;
	setDeleteUser: (user: AdminUser) => void;
	runUserAction: (
		key: string,
		action: () => Promise<{ error?: { message?: string } | null }>,
		success: string,
	) => Promise<void>;
}) {
	const t = useGT();

	const role = user.role ?? "user";
	const isBanned = Boolean(user.banned);
	const isPending = pendingAction?.endsWith(`:${user.id}`) ?? false;
	const isCurrentUser = user.id === currentUserId;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="ghost" size="icon" loading={isPending} />}>
				<Show when={!isPending}>
					<DotsThreeIcon className="size-4" />
				</Show>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuLabel>
					<T>Manage user</T>
				</DropdownMenuLabel>
				<DropdownMenuItem
					disabled={isCurrentUser}
					onClick={() =>
						runUserAction(
							`role:${user.id}`,
							() =>
								authClient.admin.setRole({
									userId: user.id,
									role: role === "admin" ? "user" : "admin",
								}),
							role === "admin" ? t("Admin role removed") : t("Admin role granted"),
						)
					}
				>
					<ShieldCheckIcon className="size-4" />
					<Show when={role === "admin"} fallback={<T>Make admin</T>}>
						<T>Make user</T>
					</Show>
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={isCurrentUser}
					onClick={() =>
						runUserAction(
							`ban:${user.id}`,
							() =>
								isBanned
									? authClient.admin.unbanUser({ userId: user.id })
									: authClient.admin.banUser({
											userId: user.id,
											banReason: "Disabled by admin",
										}),
							isBanned ? t("User unbanned") : t("User banned"),
						)
					}
				>
					<XCircleIcon className="size-4" />
					<Show when={isBanned} fallback={<T>Ban user</T>}>
						<T>Unban user</T>
					</Show>
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() =>
						runUserAction(
							`sessions:${user.id}`,
							() => authClient.admin.revokeUserSessions({ userId: user.id }),
							t("Sessions revoked"),
						)
					}
				>
					<XCircleIcon className="size-4" />
					<T>Revoke sessions</T>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					disabled={isCurrentUser}
					variant="destructive"
					onClick={() => setDeleteUser(user)}
				>
					<TrashIcon className="size-4" />
					<T>Delete user</T>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
