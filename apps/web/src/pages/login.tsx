import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T } from "gt-react";
import { useState } from "react";
import { toast } from "sonner";

import { UserInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthLayout } from "@leuchtturm/web/components/auth-layout";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@leuchtturm/web/components/ui/field";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";

export const Route = createFileRoute("/login")({
	component: Page,
});

function Page() {
	const navigate = useNavigate();
	const location = useLocation();

	const { invalidateSessions } = useAuth();

	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.signIn.email({
				email: value.email,
				password: value.password,
				callbackURL: location.href,
			});

			if (error) {
				form.setErrorMap({ onSubmit: { form: error.message, fields: {} } });
				return;
			}

			await invalidateSessions();
			await navigate({ to: "/app" });
		},
	});

	async function signInWithGoogle() {
		setIsGoogleSubmitting(true);

		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: location.href,
		});

		setIsGoogleSubmitting(false);

		if (error) {
			toast.error(error.message);
		}
	}

	return (
		<AuthLayout>
			<div className="flex flex-col gap-6">
				<h1 className="font-serif text-3xl text-center">
					<T>Welcome back</T>
				</h1>
				<Button
					type="button"
					variant="secondary"
					className="w-full"
					loading={isGoogleSubmitting}
					onClick={signInWithGoogle}
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
								<Show when={formError}>{(error) => <FieldError>{String(error)}</FieldError>}</Show>
							)}
						</form.Subscribe>
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
											field.handleChange(event.currentTarget.value);
										}}
										required
									/>
									<Show when={field.state.meta.isDirty && field.state.meta.errors.length > 0}>
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
										autoComplete="current-password"
										value={field.state.value}
										onBlur={field.handleBlur}
										onInput={(event) => {
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
									<T>Sign in</T>
								</Button>
							)}
						</form.Subscribe>
					</FieldGroup>
				</form>
				<div className="text-center text-sm">
					<T>Don&apos;t have an account?</T>{" "}
					<Link to="/signup" className="underline underline-offset-4 hover:text-primary">
						<T>Sign up</T>
					</Link>
				</div>
			</div>
		</AuthLayout>
	);
}
