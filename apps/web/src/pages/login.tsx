import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import * as Effect from "effect/Effect";
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
import { Input } from "@leuchtturm/web/components/ui/input";

const searchDefaults = { password: false };

export const Route = createFileRoute("/login")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			password: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams(searchDefaults)],
	},
	component: Page,
});

function Page() {
	const t = useGT();
	const { password } = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();

	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			resetFormError();
			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);

			if (password) {
				await signInWithPassword({ email, password: value.password });
			} else {
				await sendMagicLink({ email });
			}
		},
	});

	function setFormError(message: string) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		form.setErrorMap({ onSubmit: message } as any);
	}

	function resetFormError() {
		form.setErrorMap({ onSubmit: undefined });
	}

	async function sendMagicLink({ email }: { email: string }) {
		const { error } = await authClient.signIn.magicLink({
			email,
			callbackURL: new URL("/app", window.location.origin).toString(),
		});

		if (error) {
			setFormError(error.message ?? t("An error occurred"));
		}
	}

	async function signInWithPassword({ email, password: pw }: { email: string; password: string }) {
		const { error } = await authClient.signIn.email({ email, password: pw });

		if (error) {
			setFormError(error.message ?? t("An error occurred"));
			return;
		}

		await queryClient.invalidateQueries({ queryKey: ["session"] });
		await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
		await queryClient.invalidateQueries({ queryKey: ["organizations"] });
		await router.invalidate();

		await navigate({ to: "/app" });
	}

	async function signInWithGoogle() {
		setIsGoogleSubmitting(true);
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: new URL("/app", window.location.origin).toString(),
		});
		setIsGoogleSubmitting(false);

		if (error) {
			setFormError(error.message ?? t("An error occurred"));
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
					variant="default"
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
							{(formError) => (formError ? <FieldError>{formError}</FieldError> : null)}
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
											resetFormError();
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
						{password ? (
							<>
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
													resetFormError();
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
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => navigate({ to: "/login", search: { password: false } })}
								>
									<T>Send me a link instead</T>
								</Button>
							</>
						) : (
							<>
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button
											type="submit"
											className="w-full"
											loading={isSubmitting}
											disabled={!canSubmit}
										>
											<T>Send me a link</T>
										</Button>
									)}
								</form.Subscribe>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => navigate({ to: "/login", search: { password: true } })}
								>
									<T>Login with password</T>
								</Button>
							</>
						)}
					</FieldGroup>
				</form>
				<div className="text-center text-sm">
					<T>Don't have an account?</T>{" "}
					<Link to="/signup" className="underline underline-offset-4 hover:text-primary">
						<T>Sign up</T>
					</Link>
				</div>
			</div>
		</AuthPageLayout>
	);
}
