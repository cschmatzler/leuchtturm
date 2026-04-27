import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Organization } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthSidePanel } from "@leuchtturm/web/components/app/auth-side-panel";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import {
	Menu,
	MenuCheckboxItem,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "@leuchtturm/web/components/ui/menu";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/create-organization")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		return { session };
	},
	component: Page,
});

function Page() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { deviceSessions, setActiveSession, signOutCurrent } = useAuth();
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: {
			name: "",
			slug: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const organization = Schema.decodeSync(
				Organization.mapFields(({ name, slug }) => ({ name, slug })),
			)(value);
			const { data, error } = await authClient.organization.create(organization);

			if (error) {
				if (
					error.code === "ORGANIZATION_ALREADY_EXISTS" ||
					error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN"
				) {
					form.setFieldMeta("slug", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: t("This slug is already in use.") },
						},
					}));
					return;
				}
				setSubmitError(error.message);
				return;
			}

			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: organizationsQuery().queryKey });
			await navigate({
				to: "/$slug/settings",
				params: { slug: data.slug },
			});
		},
	});

	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex items-center justify-between gap-3">
					<Link
						to="/"
						className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
					>
						<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<SparklesIcon className="size-4" />
						</div>
						<span className="text-base font-semibold">Leuchtturm</span>
					</Link>
					<Menu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
						<MenuTrigger render={<Button size="sm" variant="ghost" />}>
							<ChevronDownIcon className="mr-2 size-3" />
							{session.user.email}
						</MenuTrigger>
						<MenuContent>
							{deviceSessions?.map((deviceSession) => (
								<MenuCheckboxItem
									key={deviceSession.session.id}
									checked={deviceSession.session.token === session.session.token}
									onClick={async () => {
										await setActiveSession(deviceSession.session.token);
										setAccountMenuOpen(false);
									}}
								>
									{deviceSession.user.email}
								</MenuCheckboxItem>
							))}
							<MenuSeparator />
							<MenuItem
								onClick={() => {
									void navigate({ to: "/login" });
								}}
							>
								{t("Add account")}
							</MenuItem>
							<MenuItem
								onClick={() => {
									void signOutCurrent();
								}}
							>
								{t("Log out")}
							</MenuItem>
						</MenuContent>
					</Menu>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
							<div className="flex flex-col gap-2 text-center">
								<h1 className="text-2xl font-semibold tracking-tight">
									{t("Create an organization")}
								</h1>
								<p className="text-balance text-muted-foreground">
									{t("Set up your workspace to get started")}
								</p>
							</div>
							<FieldGroup>
								<form.Field
									name="name"
									validators={{
										onBlur: Schema.toStandardSchemaV1(Organization.fields.name),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												placeholder={t("Acme")}
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													setSubmitError(undefined);
													field.handleChange(event.currentTarget.value);
												}}
												required
											/>
											{field.state.meta.errors.length > 0 && (
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								<form.Field
									name="slug"
									validators={{
										onBlur: Schema.toStandardSchemaV1(Organization.fields.slug),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>{t("Slug")}</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												placeholder="acme"
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													form.setFieldMeta("slug", (previous) => ({
														...previous,
														errorMap: {
															...previous.errorMap,
															onSubmit: undefined,
														},
													}));
													setSubmitError(undefined);
													field.handleChange(event.currentTarget.value);
												}}
												required
											/>
											{field.state.meta.errors.length > 0 && (
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								{submitError ? <FieldError>{submitError}</FieldError> : null}
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
											{isSubmitting ? t("Creating organization...") : t("Create organization")}
										</Button>
									)}
								</form.Subscribe>
							</FieldGroup>
						</form>
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
