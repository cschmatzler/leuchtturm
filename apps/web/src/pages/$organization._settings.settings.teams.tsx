import { GearIcon } from "@phosphor-icons/react/Gear";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { TeamInsert } from "@leuchtturm/core/auth/schema";
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
import { Show } from "@leuchtturm/web/components/ui/flow";
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
		zero?.preload(queries.organizationTeams({ organizationId }));
	},
	component: Page,
});

function Page() {
	const { organization } = Route.useParams();
	const search = Route.useSearch();
	const { organizationId, session } = Route.useRouteContext();
	const navigate = useNavigate({ from: "/$organization/settings/teams" });

	const [teams] = useZeroQuery(queries.organizationTeams({ organizationId }));

	const t = useGT();

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
						<DialogTitle>
							<T>Create team</T>
						</DialogTitle>
						<DialogDescription>
							<T>Teams organize work inside this organization.</T>
						</DialogDescription>
					</DialogHeader>
					<form action={() => form.handleSubmit()} className="space-y-6">
						<form.Field
							name="name"
							validators={{
								onBlur: Schema.toStandardSchemaV1(TeamInsert.fields.name),
							}}
						>
							{(field) => (
								<div className="space-y-2">
									<FieldLabel htmlFor={field.name}>
										<T>Name</T>
									</FieldLabel>
									<div>
										<Input
											id={field.name}
											name={field.name}
											placeholder={t("Engineering")}
											value={field.state.value}
											onBlur={field.handleBlur}
											onInput={(event) => {
												field.handleChange(event.currentTarget.value);
											}}
										/>
										<Show when={field.state.meta.isDirty && field.state.meta.errors.length > 0}>
											<FieldError className="mt-2">
												{field.state.meta.errors[0]?.message}
											</FieldError>
										</Show>
									</div>
								</div>
							)}
						</form.Field>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<DialogFooter>
									<Button type="submit" loading={isSubmitting} disabled={!canSubmit}>
										<Show when={!isSubmitting}>
											<PlusIcon className="size-4" />
										</Show>
										<T>Create team</T>
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
						<h2 className="font-display text-2xl">
							<T>Teams</T>
						</h2>
						<p className="text-sm text-muted-foreground">
							<T>Manage teams in this organization.</T>
						</p>
					</div>
					<Button type="button" onClick={() => setCreateDialogOpen(true)}>
						<PlusIcon className="size-4" />
						<T>Create team</T>
					</Button>
				</div>
				<div className="mt-5">
					<Show
						when={teams.length > 0}
						fallback={
							<div className="py-10 text-center text-sm text-muted-foreground">
								<T>Create your first team to start working in this organization.</T>
							</div>
						}
					>
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
											<T>Settings</T>
										</Button>
									</div>
								</li>
							))}
						</ul>
					</Show>
				</div>
			</section>
		</div>
	);
}
