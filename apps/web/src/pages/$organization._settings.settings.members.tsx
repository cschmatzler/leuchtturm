import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { Loader2Icon, MailPlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Email } from "@leuchtturm/core/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
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
	const { organization: slug } = Route.useParams();
	const { invite } = Route.useSearch();
	const { organizationId } = Route.useRouteContext();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [members] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [invitations] = useZeroQuery(queries.organizationInvitations({ organizationId }));
	const activeInvitations = invitations.filter((invitation) => invitation.expiresAt > Date.now());

	const setInviteDialogOpen = (value: boolean) => {
		void navigate({
			to: "/$organization/settings/members",
			params: { organization: slug },
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
											<Loader2Icon className="size-4 animate-spin" />
										) : (
											<MailPlusIcon className="size-4" />
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
						<MailPlusIcon className="size-4" />
						{t("Invite member")}
					</Button>
				</div>
				<div className="mt-5">
					{members.length ? (
						<ul className="divide-y divide-border">
							{members.map((member) => (
								<li key={member.id} className="flex items-center justify-between gap-4 py-4">
									<div>
										<p className="text-sm font-medium">{member.user?.name ?? member.userId}</p>
										{member.user?.email && (
											<p className="text-xs text-muted-foreground">{member.user.email}</p>
										)}
									</div>
									<p className="text-sm text-muted-foreground">{member.role}</p>
								</li>
							))}
						</ul>
					) : (
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("No members found.")}
						</div>
					)}
				</div>
			</section>

			<section className="border-t border-border py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Pending invitations")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("Invitations that have not been accepted yet.")}
					</p>
				</div>
				<div className="mt-5">
					{activeInvitations.length ? (
						<ul className="divide-y divide-border">
							{activeInvitations.map((invitation) => (
								<li key={invitation.id} className="flex items-center justify-between gap-4 py-4">
									<div>
										<p className="text-sm font-medium">{invitation.email}</p>
										<p className="text-xs text-muted-foreground">
											{t("Expires {{date}}", {
												date: new Date(invitation.expiresAt).toLocaleDateString(),
											})}
										</p>
									</div>
									<p className="text-sm text-muted-foreground">{invitation.role}</p>
								</li>
							))}
						</ul>
					) : (
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("No pending invitations.")}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
