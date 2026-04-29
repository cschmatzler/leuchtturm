import { SpinnerIcon, PlusIcon, GearIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Team } from "@leuchtturm/core/auth/schema";
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
import { Link } from "@leuchtturm/web/components/ui/link";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/settings/teams")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			create: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams({ create: false })],
	},
	loader: ({ context: { organizationId, zero } }) => {
		zero.preload(queries.organizationTeams({ organizationId }));
	},
	component: Page,
});

function Page() {
	const { organization } = Route.useParams();
	const search = Route.useSearch();
	const { organizationId, session } = Route.useRouteContext();
	const navigate = useNavigate({ from: "/$organization/settings/teams" });
	const { t } = useTranslation();
	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));

	const setCreateDialogOpen = (value: boolean) => {
		void navigate({
			to: "/$organization/settings/teams",
			params: { organization },
			search: (previous) => ({ ...previous, create: value }),
		});
	};

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
			const userId = session.user.id;
			{
				const { error } = await authClient.organization.addTeamMember({
					teamId: data.id,
					userId,
					organizationId,
				});
				if (error) {
					toast.error(error.message);
					return;
				}
			}
			form.reset();
			setCreateDialogOpen(false);
			toast.success(t("Team created"));
		},
	});

	return (
		<div className="mx-auto w-full max-w-3xl">
			<Dialog open={search.create} onOpenChange={setCreateDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("Create team")}</DialogTitle>
						<DialogDescription>
							{t("Teams organize work inside this organization.")}
						</DialogDescription>
					</DialogHeader>
					<form action={() => form.handleSubmit()} className="space-y-6">
						<form.Field
							name="name"
							validators={{
								onBlur: Schema.toStandardSchemaV1(Team.fields.name),
							}}
						>
							{(field) => (
								<div className="space-y-2">
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
											<PlusIcon className="size-4" />
										)}
										{t("Create team")}
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
						<h2 className="text-lg font-semibold">{t("Teams")}</h2>
						<p className="text-sm text-muted-foreground">
							{t("Manage teams in this organization.")}
						</p>
					</div>
					<Button type="button" onClick={() => setCreateDialogOpen(true)}>
						<PlusIcon className="size-4" />
						{t("Create team")}
					</Button>
				</div>
				<div className="mt-5">
					{teams.length ? (
						<>
							<ul className="divide-y divide-border">
								{teams.map((team) => (
									<li key={team.id} className="flex items-center justify-between gap-4 py-4">
										<div>
											<p className="text-sm font-medium">{team.name}</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												nativeButton={false}
												render={
													<Link
														to="/$organization/teams/$team/settings/general"
														params={{ organization, team: team.slug }}
													/>
												}
											>
												<GearIcon className="size-4" />
												{t("Settings")}
											</Button>
										</div>
									</li>
								))}
							</ul>
						</>
					) : (
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("Create your first team to start working in this organization.")}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
