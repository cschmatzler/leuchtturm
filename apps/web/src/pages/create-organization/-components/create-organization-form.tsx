import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Organization } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";

export function CreateOrganizationForm() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: {
			name: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const name = Schema.decodeSync(Organization.fields.name)(value.name);
			const organization = Schema.decodeSync(
				Organization.mapFields(({ name, slug }) => ({ name, slug })),
			)({ name, slug: name.toLowerCase() });
			const { data, error } = await authClient.organization.create(organization);

			if (error) {
				if (
					error.code === "AuthDuplicateOrganizationNameError" ||
					error.code === "ORGANIZATION_ALREADY_EXISTS" ||
					error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
					error.message === "Organization name already exists"
				) {
					form.setFieldMeta("name", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: t("This organization name is already in use.") },
						},
					}));
					return;
				}
				if (
					error.code === "AuthInvalidOrganizationPayloadError" ||
					error.message === "Organization name must contain only ASCII letters, numbers, and dashes"
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
				setSubmitError(error.message);
				return;
			}

			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: organizationsQuery().queryKey });
			await queryClient.fetchQuery(organizationsQuery());
			await router.invalidate();
			await navigate({
				to: "/$organization/settings",
				params: { organization: data.slug },
			});
		},
	});

	return (
		<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Create an organization")}</h1>
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
									form.setFieldMeta("name", (previous) => ({
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
							{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
							{t("Create organization")}
						</Button>
					)}
				</form.Subscribe>
			</FieldGroup>
		</form>
	);
}
