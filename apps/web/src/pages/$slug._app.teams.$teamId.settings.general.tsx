import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { sessionQuery } from "@leuchtturm/web/queries/session";
import { teamsQuery } from "@leuchtturm/web/queries/teams";

export const Route = createFileRoute("/$slug/_app/teams/$teamId/settings/general")({
	component: Page,
});

function Page() {
	const { slug, teamId } = Route.useParams();
	const { team, session } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const organizationId = session.session.activeOrganizationId;

	const form = useForm({
		defaultValues: {
			name: team.name,
		},
		onSubmit: async ({ value }) => {
			const name = value.name.trim();
			if (!name) return;
			const { error } = await authClient.organization.updateTeam({
				teamId,
				data: { name, organizationId: organizationId ?? undefined },
			});
			if (error) throw error;
			if (organizationId)
				await queryClient.invalidateQueries({ queryKey: teamsQuery(organizationId).queryKey });
			toast.success(t("Team updated"));
		},
	});

	const removeTeam = async () => {
		if (!organizationId) return;
		if (!window.confirm(t("Delete this team?"))) return;
		const { error } = await authClient.organization.removeTeam({ teamId, organizationId });
		if (error) throw error;
		await authClient.organization.setActiveTeam({ teamId: null });
		await queryClient.invalidateQueries({ queryKey: teamsQuery(organizationId).queryKey });
		await queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey });
		const teams = await queryClient.fetchQuery(teamsQuery(organizationId));
		const nextTeam = teams[0];
		toast.success(t("Team deleted"));
		if (nextTeam) {
			await navigate({ to: "/$slug/teams/$teamId", params: { slug, teamId: nextTeam.id } });
			return;
		}
		await navigate({ to: "/$slug/settings/teams", params: { slug } });
	};

	return (
		<div className="flex flex-col gap-8">
			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Team")}</CardTitle>
					<CardDescription>{t("Manage this team's identity.")}</CardDescription>
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
										{isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : t("Save")}
									</Button>
								</CardFooter>
							)}
						</form.Subscribe>
					</FieldGroup>
				</form>
			</Card>

			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Delete team")}</CardTitle>
					<CardDescription>{t("Delete this team and remove its memberships.")}</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border px-6 py-5">
					<Button variant="destructive" onClick={() => void removeTeam()}>
						<Trash2Icon className="size-4" />
						{t("Delete team")}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
