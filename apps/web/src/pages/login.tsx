import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Schema } from "effect";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { User } from "@chevrotain/core/auth/schema";
import { authClient } from "@chevrotain/web/clients/auth";
import { Button } from "@chevrotain/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@chevrotain/web/components/ui/field";
import { Input } from "@chevrotain/web/components/ui/input";

const loginShape = Schema.Struct({
	email: User.fields.email,
	password: Schema.String.check(Schema.isMinLength(13)),
});

export const Route = createFileRoute("/login")({
	component: Page,
});

function Page() {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const onSubmit = async (value: typeof loginShape.Type) => {
		await authClient.signIn.email(
			{
				email: value.email,
				password: value.password,
				callbackURL: "/app",
			},
			{
				onRequest: () => {
					toast.loading(t("Signing in..."));
				},
				onSuccess: () => {
					toast.dismiss();
					toast.success(t("Welcome back!"));
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
					<Link to="/" className="flex items-center gap-2 font-medium">
						Sixth Coffee
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="flex flex-col gap-6"
						>
							<div className="flex flex-col gap-2 text-center">
								<h1 className="text-3xl font-bold">{t("Welcome back")}</h1>
								<p className="text-muted-foreground text-balance">
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
												<FieldError>{t("Password must be more than 12 characters")}</FieldError>
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
			<div className="bg-muted relative hidden lg:block">
				<img
					src="https://images.unsplash.com/photo-1561986810-4f3ba2f46ceb?q=80&w=4608&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
					alt={t("Coffee")}
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	);
}
