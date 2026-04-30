import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
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

export function LoginForm() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { redirect } = useSearch({ from: "/login" });
	const queryClient = useQueryClient();
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			await authClient.signIn.email(
				{
					email: Schema.decodeSync(User.fields.email)(value.email),
					password: Schema.decodeSync(Password)(value.password),
					callbackURL: redirect ?? "/app",
				},
				{
					onRequest: () => {
						toast.loading(t("Signing in..."));
					},
					onSuccess: async () => {
						await queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey });
						await queryClient.fetchQuery(sessionQuery());
						await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
						await queryClient.invalidateQueries({ queryKey: ["organizations"] });
						toast.dismiss();
						toast.success(t("Welcome back!"));
						navigate({ to: redirect ?? "/app" });
					},
					onError: (ctx) => {
						toast.dismiss();
						setSubmitError(ctx.error.message);
					},
				},
			);
		},
	});

	return (
		<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Welcome back")}</h1>
				<p className="text-balance text-muted-foreground">
					{t("Enter your email below to login to your account")}
				</p>
			</div>
			<FieldGroup>
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
							<div className="flex items-center">
								<FieldLabel htmlFor={field.name}>{t("Password")}</FieldLabel>
								<Link
									to="/forgot-password"
									className="ml-auto text-sm underline-offset-4 hover:underline"
								>
									{t("Forgot your password?")}
								</Link>
							</div>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(e) => {
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
				{submitError ? <FieldError>{submitError}</FieldError> : null}
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
							{t("Login")}
						</Button>
					)}
				</form.Subscribe>
			</FieldGroup>
			<div className="text-center text-sm">
				{t("Don't have an account?")}{" "}
				<Link to="/signup" className="underline underline-offset-4 hover:text-primary">
					{t("Sign up")}
				</Link>
			</div>
		</form>
	);
}
