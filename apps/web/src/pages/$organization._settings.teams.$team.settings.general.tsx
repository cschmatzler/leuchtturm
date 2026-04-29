import { SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Team } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@leuchtturm/web/components/ui/alert-dialog";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { isTeamNameError } from "@leuchtturm/web/pages/-lib/team-errors";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/general")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.team({ organizationId, team }));
	},
	component: Page,
});

function Page() {
	const { organization, team } = Route.useParams();

	return <GeneralSettings organization={organization} team={team} />;
}

function GeneralSettings(props: { readonly organization: string; readonly team: string }) {
	const { organizationId } = Route.useRouteContext();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeletingTeam, setIsDeletingTeam] = useState(false);

	const form = useForm({
		defaultValues: {
			name: team?.name ?? "",
		},
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			if (!name || !team) return;
			const { data, error } = await authClient.organization.updateTeam({
				teamId: team.id,
				data: { name, organizationId },
			});
			if (error) {
				if (isTeamNameError(error)) {
					form.setFieldMeta("name", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: error.message },
						},
					}));
					return;
				}
				toast.error(error.message);
				return;
			}
			toast.success(t("Team updated"));
			if (data.slug !== props.team) {
				await navigate({
					to: "/$organization/teams/$team/settings/general",
					params: { organization: props.organization, team: data.slug },
					replace: true,
				});
			}
		},
	});

	const removeTeam = async () => {
		if (!team) return;
		setIsDeletingTeam(true);
		const { error } = await authClient.organization.removeTeam({
			teamId: team.id,
			organizationId,
		});
		setIsDeletingTeam(false);
		if (error) {
			toast.error(error.message);
			return;
		}
		setIsDeleteDialogOpen(false);
		toast.success(t("Team deleted"));
		await navigate({
			to: "/$organization/settings/teams",
			params: { organization: props.organization },
		});
	};

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Team")}</h2>
					<p className="text-sm text-muted-foreground">{t("Manage this team's identity.")}</p>
				</div>
				<form action={() => form.handleSubmit()} className="mt-5 space-y-6">
					<form.Field
						name="name"
						validators={{
							onBlur: Schema.toStandardSchemaV1(Team.fields.name),
						}}
					>
						{(field) => (
							<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
								<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
								<div>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onInput={(event) => {
											form.setFieldMeta("name", (previous) => ({
												...previous,
												errorMap: {
													...previous.errorMap,
													onSubmit: undefined,
												},
											}));
											field.handleChange(event.currentTarget.value);
										}}
										className="max-w-sm"
									/>
									{field.state.meta.errors.length > 0 && (
										<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
									)}
								</div>
							</div>
						)}
					</form.Field>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<div className="flex justify-end">
								<Button type="submit" disabled={!canSubmit || isSubmitting}>
									{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : t("Save")}
								</Button>
							</div>
						)}
					</form.Subscribe>
				</form>
			</section>

			<Separator />

			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Delete team")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("Delete this team and remove its memberships.")}
					</p>
				</div>
				<div className="mt-5">
					<Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
						<TrashIcon className="size-4" />
						{t("Delete team")}
					</Button>
				</div>
				<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t("Delete this team?")}</AlertDialogTitle>
							<AlertDialogDescription>{t("This action cannot be undone.")}</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeletingTeam}>{t("Cancel")}</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								disabled={isDeletingTeam || !team}
								onClick={() => void removeTeam()}
							>
								{isDeletingTeam ? <SpinnerIcon className="size-4 animate-spin" /> : null}
								{t("Delete")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</section>
		</div>
	);
}
