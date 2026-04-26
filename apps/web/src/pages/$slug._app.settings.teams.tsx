import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
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
import { teamsQuery } from "@leuchtturm/web/queries/teams";

export const Route = createFileRoute("/$slug/_app/settings/teams")({
	component: Page,
});

function Page() {
	const { slug } = Route.useParams();
	const { organizationId } = Route.useRouteContext();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { data: teams } = useQuery(teamsQuery(organizationId));

	const form = useForm({
		defaultValues: {
			name: "",
		},
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			if (!name) return;
			const { data, error } = await authClient.organization.createTeam({
				name,
				organizationId,
			});
			if (error) throw error;
			await queryClient.invalidateQueries({ queryKey: teamsQuery(organizationId).queryKey });
			form.reset();
			toast.success(t("Team created"));
			await navigate({ to: "/$slug/teams/$teamId", params: { slug, teamId: data.id } });
		},
	});

	const removeTeam = async (teamId: string) => {
		if (!window.confirm(t("Delete this team?"))) return;
		const { error } = await authClient.organization.removeTeam({ teamId, organizationId });
		if (error) throw error;
		await queryClient.invalidateQueries({ queryKey: teamsQuery(organizationId).queryKey });
		toast.success(t("Team deleted"));
	};

	return (
		<div className="flex flex-col gap-8">
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
									onBlur: ({ value }) =>
										value.trim().length === 0 ? t("Team name is required") : undefined,
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
												onInput={(event) => field.handleChange(event.currentTarget.value)}
												className="max-w-sm"
											/>
											{field.state.meta.errors.length > 0 && (
												<FieldError className="mt-2">{field.state.meta.errors[0]}</FieldError>
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
					{teams?.length ? (
						<ul className="divide-y divide-border">
							{teams.map((team) => (
								<li key={team.id} className="flex items-center justify-between gap-4 px-6 py-4">
									<div>
										<p className="text-sm font-medium">{team.name}</p>
										<p className="text-xs text-muted-foreground">{team.id}</p>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											render={
												<Link
													to="/$slug/teams/$teamId/settings"
													params={{ slug, teamId: team.id }}
												/>
											}
										>
											<SettingsIcon className="size-4" />
											{t("Settings")}
										</Button>
										<Button
											variant="destructive"
											size="sm"
											onClick={() => void removeTeam(team.id)}
										>
											<Trash2Icon className="size-4" />
											{t("Delete")}
										</Button>
									</div>
								</li>
							))}
						</ul>
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
