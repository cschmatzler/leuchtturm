import {
	CalendarIcon,
	SpinnerIcon,
	EnvelopeIcon,
	EnvelopeSimpleIcon,
	ShieldIcon,
	UserIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getFilteredRowModel,
	useReactTable,
	type ColumnDef,
} from "@tanstack/react-table";
import { Effect, Schema } from "effect";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Role } from "@leuchtturm/core/auth/schema";
import { Email } from "@leuchtturm/core/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { DataTable } from "@leuchtturm/web/components/data-table";
import {
	createTanStackColumns,
	createTanStackFilters,
} from "@leuchtturm/web/components/data-table-filter/tanstack";
import type { ColumnConfig } from "@leuchtturm/web/components/data-table-filter/types";
import { Badge } from "@leuchtturm/web/components/ui/badge";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@leuchtturm/web/components/ui/dialog";
import { FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useDataTableFilters } from "@leuchtturm/web/hooks/use-data-table-filters";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

const searchDefaults = { invite: false };

export const Route = createFileRoute("/$organization/_settings/settings/members")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			invite: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams(searchDefaults)],
	},
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationMembers({ organizationId }));
		zero.preload(queries.organizationInvitations({ organizationId }));
	},
	component: Page,
});

function Page() {
	const { organization } = Route.useParams();
	const { invite } = Route.useSearch();
	const { organizationId } = Route.useRouteContext();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [members] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [invitations] = useZeroQuery(queries.organizationInvitations({ organizationId }));
	const activeInvitations = useMemo(
		() => invitations.filter((invitation) => invitation.expiresAt > Date.now()),
		[invitations],
	);

	const roleOptions = useMemo(
		() =>
			Role.literals.map((role) => ({
				label: `${role.charAt(0).toUpperCase()}${role.slice(1)}`,
				value: role,
			})),
		[],
	);

	const memberColumns = useMemo<ColumnDef<(typeof members)[number]>[]>(
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
		],
		[t],
	);
	const memberFilterDefinitions = useMemo(
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
			] satisfies ColumnConfig<(typeof members)[number]>[],
		[roleOptions, t],
	);
	const memberFilters = useDataTableFilters({
		strategy: "client",
		data: members,
		filterDefinitions: memberFilterDefinitions,
	});
	const memberTableColumns = useMemo(
		() =>
			createTanStackColumns({
				columns: memberColumns,
				filterColumns: memberFilters.filterColumns,
			}),
		[memberColumns, memberFilters.filterColumns],
	);
	const memberColumnFilters = useMemo(
		() => createTanStackFilters(memberFilters.filters),
		[memberFilters.filters],
	);
	const memberTable = useReactTable({
		data: members,
		columns: memberTableColumns,
		state: { columnFilters: memberColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	const invitationColumns = useMemo<ColumnDef<(typeof activeInvitations)[number]>[]>(
		() => [
			{
				id: "email",
				header: t("Email"),
				accessorFn: (invitation) => invitation.email,
				cell: ({ getValue }) => <p className="text-sm font-medium">{getValue<string>()}</p>,
			},
			{
				id: "role",
				header: t("Role"),
				accessorFn: (invitation) => invitation.role ?? "",
				cell: ({ getValue }) => {
					const role = getValue<string>();
					return (
						<Badge variant="outline">{`${role.charAt(0).toUpperCase()}${role.slice(1)}`}</Badge>
					);
				},
			},
			{
				id: "expiresAt",
				header: t("Expires"),
				accessorFn: (invitation) => new Date(invitation.expiresAt),
				cell: ({ getValue }) => (
					<p className="text-sm text-muted-foreground">{getValue<Date>().toLocaleDateString()}</p>
				),
			},
		],
		[t],
	);
	const invitationFilterDefinitions = useMemo(
		() =>
			[
				{
					id: "email",
					accessor: (invitation) => invitation.email,
					displayName: t("Email"),
					icon: EnvelopeIcon,
					type: "text",
				},
				{
					id: "role",
					accessor: (invitation) => invitation.role ?? "",
					displayName: t("Role"),
					icon: ShieldIcon,
					type: "option",
					options: roleOptions,
				},
				{
					id: "expiresAt",
					accessor: (invitation) => new Date(invitation.expiresAt),
					displayName: t("Expires"),
					icon: CalendarIcon,
					type: "date",
				},
			] satisfies ColumnConfig<(typeof activeInvitations)[number]>[],
		[roleOptions, t],
	);
	const invitationFilters = useDataTableFilters({
		strategy: "client",
		data: activeInvitations,
		filterDefinitions: invitationFilterDefinitions,
	});
	const invitationTableColumns = useMemo(
		() =>
			createTanStackColumns({
				columns: invitationColumns,
				filterColumns: invitationFilters.filterColumns,
			}),
		[invitationColumns, invitationFilters.filterColumns],
	);
	const invitationColumnFilters = useMemo(
		() => createTanStackFilters(invitationFilters.filters),
		[invitationFilters.filters],
	);
	const invitationTable = useReactTable({
		data: activeInvitations,
		columns: invitationTableColumns,
		state: { columnFilters: invitationColumnFilters },
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	});

	const setInviteDialogOpen = (value: boolean) => {
		void navigate({
			to: "/$organization/settings/members",
			params: { organization },
			search: (previous) => ({ ...previous, invite: value }),
		});
	};

	const form = useForm({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			const email = value.email.trim().toLowerCase();
			if (!email) return;
			const { error } = await authClient.organization.inviteMember({
				email,
				role: "member",
				organizationId,
			});
			if (error) {
				form.setFieldMeta("email", (previous) => ({
					...previous,
					errorMap: {
						...previous.errorMap,
						onSubmit: { message: error.message },
					},
				}));
				return;
			}
			form.reset();
			setInviteDialogOpen(false);
			toast.success(t("Member invited"));
		},
	});

	return (
		<div className="mx-auto w-full max-w-3xl">
			<Dialog open={invite} onOpenChange={setInviteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("Invite member")}</DialogTitle>
						<DialogDescription>{t("Invite a new member to this organization.")}</DialogDescription>
					</DialogHeader>
					<form action={() => form.handleSubmit()} className="space-y-6">
						<form.Field
							name="email"
							validators={{
								onBlur: Schema.toStandardSchemaV1(Email),
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<FieldLabel htmlFor={field.name}>{t("Email")}</FieldLabel>
									<div>
										<Input
											id={field.name}
											name={field.name}
											type="email"
											placeholder={t("member@example.com")}
											value={field.state.value}
											onBlur={field.handleBlur}
											onInput={(event) => {
												form.setFieldMeta("email", (previous) => ({
													...previous,
													errorMap: {
														...previous.errorMap,
														onSubmit: undefined,
													},
												}));
												field.handleChange(event.currentTarget.value);
											}}
										/>
										{field.state.meta.errors.length > 0 && (
											<FieldError className="mt-2">
												{field.state.meta.errors[0]?.message}
											</FieldError>
										)}
									</div>
								</div>
							)}
						</form.Field>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<DialogFooter>
									<Button type="submit" disabled={!canSubmit || isSubmitting}>
										{isSubmitting ? (
											<SpinnerIcon className="size-4 animate-spin" />
										) : (
											<EnvelopeSimpleIcon className="size-4" />
										)}
										{t("Invite member")}
									</Button>
								</DialogFooter>
							)}
						</form.Subscribe>
					</form>
				</DialogContent>
			</Dialog>

			<section className="py-6">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="text-lg font-semibold">{t("Organization members")}</h2>
						<p className="text-sm text-muted-foreground">
							{t("Manage access at the organization level.")}
						</p>
					</div>
					<Button type="button" onClick={() => setInviteDialogOpen(true)}>
						<EnvelopeSimpleIcon className="size-4" />
						{t("Invite member")}
					</Button>
				</div>
				<DataTable
					className="mt-5"
					table={memberTable}
					filterColumns={memberFilters.filterColumns}
					filters={memberFilters.filters}
					actions={memberFilters.actions}
					emptyIcon={UserIcon}
					emptyRowName={t("members")}
				/>
			</section>

			<section className="border-t border-border py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Pending invitations")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("Invitations that have not been accepted yet.")}
					</p>
				</div>
				<DataTable
					className="mt-5"
					table={invitationTable}
					filterColumns={invitationFilters.filterColumns}
					filters={invitationFilters.filters}
					actions={invitationFilters.actions}
					emptyIcon={EnvelopeSimpleIcon}
					emptyRowName={t("invitations")}
				/>
			</section>
		</div>
	);
}
