import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	stripSearchParams,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { T, useGT, Var } from "gt-react";
import { useState } from "react";

import { UserInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";

export const Route = createFileRoute("/signup")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			password: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams({ password: false })],
	},
	component: Page,
});

function Page() {
	const { password } = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();

	const t = useGT();

	const [magicLinkSentTo, setMagicLinkSentTo] = useState<string>();
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			password: "",
		},
		validators: {
			onSubmitAsync: async ({ value }) => {
				const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
				const name = Schema.decodeSync(UserInsert.fields.name)(value.name);

				if (password) {
					const { error } = await authClient.signUp.email({
						name,
						email,
						password: value.password,
					});

					if (error) return error.message;
					return null;
				}

				const { error } = await authClient.signIn.magicLink({
					email,
					name,
					callbackURL: router.history.createHref("/app"),
				});

				if (error) return error.message;
				return null;
			},
		},
		onSubmit: async ({ value }) => {
			if (password) return;

			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
			setMagicLinkSentTo(email);
		},
	});

	async function signUpWithGoogle() {
		setMagicLinkSentTo(undefined);
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
				<div className="flex flex-col gap-2 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">
						<T>Create an account</T>
					</h1>
					<p className="text-balance text-muted-foreground">
						<T>Sign up with your email or Google to create your account</T>
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
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
							{(formError) => (formError ? <FieldError>{String(formError)}</FieldError> : null)}
						</form.Subscribe>
						{magicLinkSentTo ? (
							<FieldDescription className="text-center">
								<T>
									Check your inbox for a sign-up link sent to <Var>{magicLinkSentTo}</Var>.
								</T>
							</FieldDescription>
						) : null}
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
											setMagicLinkSentTo(undefined);
											field.handleChange(event.currentTarget.value);
										}}
										disabled={isGoogleSubmitting}
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
											setMagicLinkSentTo(undefined);
											field.handleChange(event.currentTarget.value);
										}}
										disabled={isGoogleSubmitting}
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
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => navigate({ to: "/signup", search: { password: false } })}
								>
									<T>Login with magic code</T>
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
											<T>Send one-time code</T>
										</Button>
									)}
								</form.Subscribe>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => navigate({ to: "/signup", search: { password: true } })}
								>
									<T>Sign up with password</T>
								</Button>
							</>
						)}
					</FieldGroup>
				</form>
				<div className="text-center text-sm">
					<T>Already have an account?</T>{" "}
					<Link to="/login" className="underline underline-offset-4 hover:text-primary">
						<T>Sign in</T>
					</Link>
				</div>
			</div>
		</AuthPageLayout>
	);
}
