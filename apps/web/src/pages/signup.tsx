import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type } from "arktype";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Account, User } from "@one/core/auth/schema";
import { authClient } from "@one/web/clients/auth";
import { Button } from "@one/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@one/web/components/ui/field";
import { Input } from "@one/web/components/ui/input";
export const Route = createFileRoute("/signup")({
	component: Page,
});

function Page() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	const shape = type({
		name: User.get("name"),
		email: User.get("email"),
		password: Account.get("password").exclude("null"),
	});

	const onSubmit = async (value: typeof shape.infer) => {
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
								<h1 className="text-3xl font-bold">{t("Create an account")}</h1>
								<p className="text-muted-foreground text-balance">
									{t("Enter your email below to create your account")}
								</p>
							</div>
							<FieldGroup>
								<form.Field
									name="name"
									validators={{
										onChange: shape.get("name"),
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
												<FieldError>{String(field.state.meta.errors[0])}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								<form.Field
									name="email"
									validators={{
										onChange: shape.get("email"),
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
												<FieldError>{String(field.state.meta.errors[0])}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								<form.Field
									name="password"
									validators={{
										onChange: shape.get("password"),
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
												<FieldError>{t("Password must be more than 12 characters")}</FieldError>
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
