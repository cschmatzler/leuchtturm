import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { useState } from "react";

import { UserInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@leuchtturm/web/components/ui/field";
import { Match, Show, Switch } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";

export const Route = createFileRoute("/signup")({
	component: Page,
});

function Page() {
	const location = useLocation();

	const t = useGT();

	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
	const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string>();

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
		},
		validators: {
			onSubmitAsync: async ({ value }) => {
				const name = Schema.decodeSync(UserInsert.fields.name)(value.name);
				const email = Schema.decodeSync(UserInsert.fields.email)(value.email);

				const { error } = await authClient.signUp.email({
					name,
					email,
					password: value.password,
					callbackURL: location.href,
				});

				if (error) return error.message;
				return null;
			},
		},
		onSubmit: async ({ value }) => {
			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
			setPendingVerificationEmail(email);
		},
	});

	async function signUpWithGoogle() {
		setIsGoogleSubmitting(true);
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: location.href,
		});
		setIsGoogleSubmitting(false);

		if (error) {
			form.setErrorMap({ onSubmit: error.message });
		}
	}

	return (
		<AuthPageLayout>
			<Switch>
				<Match when={!pendingVerificationEmail}>
					<div className="flex flex-col gap-6">
						<div className="flex flex-col gap-2 text-center">
							<h1 className="font-display text-3xl">
								<T>Create an account</T>
							</h1>
							<p className="text-balance text-muted-foreground">
								<T>Sign up with your email and password or Google to create your account</T>
							</p>
						</div>
						<Button
							type="button"
							variant="secondary"
							className="w-full"
							loading={isGoogleSubmitting}
							onClick={signUpWithGoogle}
						>
							<T>Continue with Google</T>
						</Button>
						<FieldSeparator>
							<T>or</T>
						</FieldSeparator>
						<form action={() => form.handleSubmit()}>
							<FieldGroup>
								<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
									{(formError) => (
										<Show when={formError}>
											{(error) => <FieldError>{String(error)}</FieldError>}
										</Show>
									)}
								</form.Subscribe>
								<form.Field
									name="name"
									validators={{
										onBlur: Schema.toStandardSchemaV1(UserInsert.fields.name),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>
												<T>Name</T>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												autoComplete="name"
												placeholder={t("Your name")}
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													form.setErrorMap({ onSubmit: undefined });
													field.handleChange(event.currentTarget.value);
												}}
												disabled={isGoogleSubmitting}
												required
											/>
											<Show when={field.state.meta.errors.length > 0}>
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											</Show>
										</Field>
									)}
								</form.Field>
								<form.Field
									name="email"
									validators={{
										onBlur: Schema.toStandardSchemaV1(UserInsert.fields.email),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>
												<T>Email</T>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="email"
												autoComplete="email"
												placeholder="you@example.com"
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													form.setErrorMap({ onSubmit: undefined });
													field.handleChange(event.currentTarget.value);
												}}
												disabled={isGoogleSubmitting}
												required
											/>
											<Show when={field.state.meta.errors.length > 0}>
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											</Show>
										</Field>
									)}
								</form.Field>
								<form.Field name="password">
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>
												<T>Password</T>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												type="password"
												autoComplete="new-password"
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													form.setErrorMap({ onSubmit: undefined });
													field.handleChange(event.currentTarget.value);
												}}
												required
											/>
										</Field>
									)}
								</form.Field>
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button
											type="submit"
											className="w-full"
											loading={isSubmitting}
											disabled={!canSubmit}
										>
											<T>Create account</T>
										</Button>
									)}
								</form.Subscribe>
							</FieldGroup>
						</form>
						<div className="text-center text-sm">
							<T>Already have an account?</T>{" "}
							<Link to="/login" className="underline underline-offset-4 hover:text-primary">
								<T>Sign in</T>
							</Link>
						</div>
					</div>
				</Match>
				<Match when={pendingVerificationEmail}>
					{(email) => (
						<div className="flex flex-col gap-6 text-center">
							<div className="flex flex-col gap-2">
								<h1 className="font-display text-3xl">
									<T>Check your inbox</T>
								</h1>
								<p className="text-balance text-muted-foreground">
									<T>We created your account. Please verify {email} before signing in.</T>
								</p>
							</div>
						</div>
					)}
				</Match>
			</Switch>
		</AuthPageLayout>
	);
}
