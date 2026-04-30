import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Password, User } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export function SignupForm() {
	const navigate = useNavigate();
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const user = Schema.decodeSync(User.mapFields(({ name, email }) => ({ name, email })))(value);
			await authClient.signUp.email(
				{
					...user,
					password: Schema.decodeSync(Password)(value.password),
					callbackURL: "/app",
				},
				{
					onRequest: () => {
						toast.loading(t("Creating account..."));
					},
					onSuccess: async () => {
						await queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey });
						await queryClient.fetchQuery(sessionQuery());
						await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
						await queryClient.invalidateQueries({ queryKey: ["organizations"] });
						toast.dismiss();
						toast.success(t("Account created!"));
						navigate({ to: "/app" });
					},
					onError: (ctx) => {
						toast.dismiss();
						if (
							ctx.error.code === "USER_ALREADY_EXISTS" ||
							ctx.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
						) {
							form.setFieldMeta("email", (previous) => ({
								...previous,
								errorMap: {
									...previous.errorMap,
									onSubmit: { message: t("An account with this email already exists.") },
								},
							}));
							return;
						}
						setSubmitError(ctx.error.message);
					},
				},
			);
		},
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<form action={submitForm} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Create an account")}</h1>
				<p className="text-balance text-muted-foreground">
					{t("Enter your email below to create your account")}
				</p>
			</div>
			<FieldGroup>
				<form.Field
					name="name"
					validators={{
						onBlur: Schema.toStandardSchemaV1(User.fields.name),
					}}
				>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								placeholder="John Doe"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(e) => field.handleChange(e.currentTarget.value)}
								required
							/>
							{field.state.meta.errors.length > 0 && (
								<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
							)}
						</Field>
					)}
				</form.Field>
				<form.Field
					name="email"
					validators={{
						onBlur: Schema.toStandardSchemaV1(User.fields.email),
					}}
				>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>{t("Email")}</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								placeholder="m@example.com"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(e) => {
									form.setFieldMeta("email", (previous) => ({
										...previous,
										errorMap: {
											...previous.errorMap,
											onSubmit: undefined,
										},
									}));
									setSubmitError(undefined);
									field.handleChange(e.currentTarget.value);
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
					name="password"
					validators={{
						onBlur: Schema.toStandardSchemaV1(Password),
					}}
				>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>{t("Password")}</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(e) => field.handleChange(e.currentTarget.value)}
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
							{t("Sign Up")}
						</Button>
					)}
				</form.Subscribe>
			</FieldGroup>
			<div className="text-center text-sm">
				{t("Already have an account?")}{" "}
				<Link to="/login" className="underline underline-offset-4 hover:text-primary">
					{t("Sign in")}
				</Link>
			</div>
		</form>
	);
}
