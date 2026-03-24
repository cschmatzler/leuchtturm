import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { MailIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PASSWORD_VALIDATION_MESSAGE, Password, User } from "@chevrotain/core/auth/schema";
import { authClient } from "@chevrotain/web/clients/auth";
import { AuthSidePanel } from "@chevrotain/web/components/app/auth-side-panel";
import { Button } from "@chevrotain/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@chevrotain/web/components/ui/field";
import { Input } from "@chevrotain/web/components/ui/input";

const signupShape = Schema.Struct({
	name: User.fields.name,
	email: User.fields.email,
	password: Password,
});

export const Route = createFileRoute("/signup")({
	component: Page,
});

function Page() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	const onSubmit = async (value: typeof signupShape.Type) => {
		await authClient.signUp.email(
			{
				email: value.email,
				password: value.password,
				name: value.name,
				callbackURL: "/app",
			},
			{
				onRequest: () => {
					toast.loading(t("Creating account..."));
				},
				onSuccess: () => {
					toast.dismiss();
					toast.success(t("Account created!"));
					navigate({ to: "/app" });
				},
				onError: (ctx) => {
					toast.dismiss();
					toast.error(ctx.error.message);
				},
			},
		);
	};

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		onSubmit: ({ value }) => onSubmit(value),
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link
						to="/"
						className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
					>
						<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<MailIcon className="size-4" />
						</div>
						<span className="text-base font-semibold">Chevrotain</span>
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
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
										onChange: Schema.toStandardSchemaV1(signupShape.fields.name),
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
										onChange: Schema.toStandardSchemaV1(signupShape.fields.email),
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
									name="password"
									validators={{
										onChange: Schema.toStandardSchemaV1(signupShape.fields.password),
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
												<FieldError>{t(PASSWORD_VALIDATION_MESSAGE)}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit]) => (
										<Button type="submit" className="w-full" disabled={!canSubmit}>
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
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
