import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { MailIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PASSWORD_VALIDATION_MESSAGE, Password, User } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthSidePanel } from "@leuchtturm/web/components/app/auth-side-panel";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { sessionQuery } from "@leuchtturm/web/queries/session";

const loginShape = Schema.Struct({
	email: User.fields.email,
	password: Password,
});

export const Route = createFileRoute("/login")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const onSubmit = async (value: typeof loginShape.Type) => {
		await authClient.signIn.email(
			{
				email: value.email,
				password: value.password,
				callbackURL: "/mail",
			},
			{
				onRequest: () => {
					toast.loading(t("Signing in..."));
				},
				onSuccess: async () => {
					await queryClient.invalidateQueries({ queryKey: sessionQuery().queryKey });
					await queryClient.fetchQuery(sessionQuery());
					toast.dismiss();
					toast.success(t("Welcome back!"));
					navigate({ to: "/mail" });
				},
				onError: (ctx) => {
					toast.dismiss();
					toast.error(ctx.error.message);
				},
			},
		);
	};

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: ({ value }) => onSubmit(value),
	});

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
						<span className="text-base font-semibold">Leuchtturm</span>
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
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
										onChange: Schema.toStandardSchemaV1(loginShape.fields.email),
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
										onChange: Schema.toStandardSchemaV1(loginShape.fields.password),
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
												onInput={(e) => field.handleChange(e.currentTarget.value)}
												required
											/>
											{field.state.meta.errors.length > 0 && (
												<FieldError>{t(PASSWORD_VALIDATION_MESSAGE)}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								<form.Subscribe selector={(state) => [state.canSubmit]}>
									{([canSubmit]) => (
										<Button type="submit" className="w-full" disabled={!canSubmit}>
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
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
