import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T } from "gt-react";
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
import { Input } from "@leuchtturm/web/components/ui/input";

export const Route = createFileRoute("/login")({
	component: Page,
});

function Page() {
	const navigate = useNavigate();
	const router = useRouter();

	const queryClient = useQueryClient();

	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmitAsync: async ({ value }) => {
				const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
				return await signInWithPassword({ email, password: value.password });
			},
		},
		onSubmit: async () => {
			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: ["organizations"] });
			await router.invalidate();
			await navigate({ to: "/app" });
		},
	});

	async function signInWithPassword({ email, password }: { email: string; password: string }) {
		const { error } = await authClient.signIn.email({
			email,
			password,
			callbackURL: new URL(router.history.createHref("/app"), window.location.origin).href,
		});

		if (error) return error.message;
		return null;
	}

	async function signInWithGoogle() {
		setIsGoogleSubmitting(true);
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: router.history.createHref("/app"),
		});
		setIsGoogleSubmitting(false);

		if (error) {
			form.setErrorMap({ onSubmit: error.message });
		}
	}

	return (
		<AuthPageLayout>
			<div className="flex flex-col gap-6">
				<h1 className="text-2xl font-semibold tracking-tight text-center">
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
							{(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
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
											form.setErrorMap({ onSubmit: undefined });
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
		</AuthPageLayout>
	);
}
