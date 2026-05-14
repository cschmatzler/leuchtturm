import { TrashIcon } from "@phosphor-icons/react/Trash";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { T, useGT, Var } from "gt-react";
import { useState } from "react";
import { toast } from "sonner";

import { TeamInsert } from "@leuchtturm/core/auth/schema";
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
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

const searchDefaults = { delete: false };

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/general")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			delete: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams(searchDefaults)],
	},
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero?.preload(queries.team({ organizationId, team }));
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

	const { delete: isDeleteDialogOpen } = Route.useSearch();

	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));

	const t = useGT();

	const [deleteTeamConfirmation, setDeleteTeamConfirmation] = useState("");
	const [isDeletingTeam, setIsDeletingTeam] = useState(false);

	const setDeleteDialogOpen = (value: boolean) => {
		navigate({
			to: "/$organization/teams/$team/settings/general",
			params: { organization: props.organization, team: props.team },
			search: (previous) => ({ ...previous, delete: value }),
		});
	};

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
				if (
					error.code === "AuthDuplicateTeamNameError" ||
					error.code === "AuthInvalidTeamPayloadError"
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
		if (!team || deleteTeamConfirmation !== team.name) return;
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
		setDeleteDialogOpen(false);
		setDeleteTeamConfirmation("");
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
					<h2 className="font-serif text-2xl">
						<T>Team</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Manage this team&apos;s identity.</T>
					</p>
				</div>
				<form action={() => form.handleSubmit()} className="mt-5 space-y-6">
					<form.Field
						name="name"
						validators={{
							onBlur: Schema.toStandardSchemaV1(TeamInsert.fields.name),
						}}
					>
						{(field) => (
							<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
								<FieldLabel htmlFor={field.name}>
									<T>Name</T>
								</FieldLabel>
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
									<Show when={field.state.meta.errors.length > 0}>
										<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
									</Show>
								</div>
							</div>
						)}
					</form.Field>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<div className="flex justify-end">
								<Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
									<T>Save</T>
								</Button>
							</div>
						)}
					</form.Subscribe>
				</form>
			</section>

			<Separator />

			<section className="py-6">
				<div className="space-y-1">
					<h2 className="font-serif text-2xl">
						<T>Delete team</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Delete this team and remove its memberships.</T>
					</p>
				</div>
				<div className="mt-5">
					<Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
						<TrashIcon className="size-4" />
						<T>Delete team</T>
					</Button>
				</div>
				<AlertDialog
					open={isDeleteDialogOpen}
					onOpenChange={(open) => {
						setDeleteDialogOpen(open);
						if (!open) setDeleteTeamConfirmation("");
					}}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								<T>Delete this team?</T>
							</AlertDialogTitle>
							<AlertDialogDescription>
								<T>This action cannot be undone.</T>
							</AlertDialogDescription>
						</AlertDialogHeader>
						<div className="space-y-2">
							<FieldLabel htmlFor="delete-team-confirmation">
								<T>
									Type <Var>{team?.name}</Var> to confirm deletion.
								</T>
							</FieldLabel>
							<Input
								id="delete-team-confirmation"
								value={deleteTeamConfirmation}
								onInput={(event) => setDeleteTeamConfirmation(event.currentTarget.value)}
							/>
						</div>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeletingTeam}>
								<T>Cancel</T>
							</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								loading={isDeletingTeam}
								disabled={!team || deleteTeamConfirmation !== team.name}
								onClick={() => removeTeam()}
							>
								<T>Delete</T>
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</section>
		</div>
	);
}
