import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { Loader2Icon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
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
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { Link } from "@leuchtturm/web/components/ui/link";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/settings/teams")({
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
	},
	component: Page,
});

function Page() {
	const { organization: slug } = Route.useParams();
	const { organizationId, session } = Route.useRouteContext();
	const { t } = useTranslation();
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));
	const [teamPendingDeletion, setTeamPendingDeletion] = useState<string>();
	const [isDeletingTeam, setIsDeletingTeam] = useState(false);

	const form = useForm({
		defaultValues: {
			name: "",
		},
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			if (!name) return;
			const { data, error } = await authClient.organization.createTeam({
				name,
				slug: name,
				organizationId,
			});
			if (error) {
				if (
					error.code === "AuthDuplicateTeamNameError" ||
					error.code === "AuthInvalidTeamPayloadError" ||
					error.message === "Team name already exists" ||
					error.message ===
						"Team name must contain only ASCII letters, numbers, dashes, and underscores"
				) {
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
			const userId = session.user.id;
			const { error: addMemberError } = await authClient.organization.addTeamMember({
				teamId: data.id,
				userId,
				organizationId,
			});
			if (addMemberError) {
				toast.error(addMemberError.message);
				return;
			}
			form.reset();
			toast.success(t("Team created"));
		},
	});

	const removeTeam = async (teamId: string) => {
		setIsDeletingTeam(true);
		const { error } = await authClient.organization.removeTeam({ teamId, organizationId });
		setIsDeletingTeam(false);
		if (error) {
			toast.error(error.message);
			return;
		}
		setTeamPendingDeletion(undefined);
		toast.success(t("Team deleted"));
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Create team")}</CardTitle>
					<CardDescription>{t("Teams organize work inside this organization.")}</CardDescription>
				</CardHeader>
				<form action={() => form.handleSubmit()}>
					<FieldGroup>
						<CardContent className="border-t border-border px-6 py-5">
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
												placeholder={t("Engineering")}
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
												<FieldError className="mt-2">
													{field.state.meta.errors[0]?.message}
												</FieldError>
											)}
										</div>
									</div>
								)}
							</form.Field>
						</CardContent>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<CardFooter className="justify-end border-t border-border bg-muted/30 px-6 py-4">
									<Button type="submit" disabled={!canSubmit || isSubmitting}>
										{isSubmitting ? (
											<Loader2Icon className="size-4 animate-spin" />
										) : (
											<PlusIcon className="size-4" />
										)}
										{t("Create team")}
									</Button>
								</CardFooter>
							)}
						</form.Subscribe>
					</FieldGroup>
				</form>
			</Card>
			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Teams")}</CardTitle>
					<CardDescription>{t("Manage teams in this organization.")}</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border p-0">
					{teams.length ? (
						<>
							<ul className="divide-y divide-border">
								{teams.map((team) => (
									<li key={team.id} className="flex items-center justify-between gap-4 px-6 py-4">
										<div>
											<p className="text-sm font-medium">{team.name}</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												render={
													<Link
														to="/$organization/teams/$team/settings/general"
														params={{ organization: slug, team: team.slug }}
													/>
												}
											>
												<SettingsIcon className="size-4" />
												{t("Settings")}
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => setTeamPendingDeletion(team.id)}
											>
												<Trash2Icon className="size-4" />
												{t("Delete")}
											</Button>
										</div>
									</li>
								))}
							</ul>
							<AlertDialog
								open={teamPendingDeletion !== undefined}
								onOpenChange={(open) => {
									if (!open) setTeamPendingDeletion(undefined);
								}}
							>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>{t("Delete this team?")}</AlertDialogTitle>
										<AlertDialogDescription>
											{t("This action cannot be undone.")}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel disabled={isDeletingTeam}>{t("Cancel")}</AlertDialogCancel>
										<AlertDialogAction
											variant="destructive"
											disabled={isDeletingTeam || teamPendingDeletion === undefined}
											onClick={() => {
												if (teamPendingDeletion) void removeTeam(teamPendingDeletion);
											}}
										>
											{isDeletingTeam ? <Loader2Icon className="size-4 animate-spin" /> : null}
											{t("Delete")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</>
					) : (
						<div className="px-6 py-10 text-center text-sm text-muted-foreground">
							{t("Create your first team to start working in this organization.")}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
