import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { useState } from "react";
import { toast } from "sonner";

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
	validateSearch: (search) => {
		if (
			typeof search.redirect === "string" &&
			search.redirect.startsWith("/") &&
			!search.redirect.startsWith("//")
		) {
			return { redirect: search.redirect };
		}

		return {};
	},
	component: Page,
});

function Page() {
	const t = useGT();
	const { redirect } = Route.useSearch();
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();

	const [submitError, setSubmitError] = useState<string>();
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const callbackURL = new URL(redirect ?? "/app", window.location.origin).toString();
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);

			if (showPassword) {
				toast.loading(t("Signing in..."));
				const { error } = await authClient.signIn.email({ email, password: value.password });
				toast.dismiss();

				if (error) {
					setSubmitError(error.message);
					return;
				}

				toast.success(t("Signed in"));
				await queryClient.invalidateQueries({ queryKey: ["session"] });
				await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
				await queryClient.invalidateQueries({ queryKey: ["organizations"] });
				await router.invalidate();
				await navigate({ to: redirect ?? "/app" });
			} else {
				toast.loading(t("Sending sign-in link..."));
				const { error } = await authClient.signIn.magicLink({ email, callbackURL });
				toast.dismiss();

				if (error) {
					setSubmitError(error.message);
					return;
				}

				toast.success(t("Sign-in link sent"));
			}
		},
	});

	const signInWithGoogle = async () => {
		setIsGoogleSubmitting(true);
		toast.loading(t("Signing in..."));
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL,
		});
		toast.dismiss();
		setIsGoogleSubmitting(false);

		if (error) {
			toast.error(error.message);
		}
	};

	return (
		<AuthPageLayout>
			<div className="flex flex-col gap-6">
				<h1 className="text-2xl font-semibold tracking-tight text-center">
					<T>Welcome back</T>
				</h1>
				<Button
					type="button"
					variant="outline"
					className="w-full"
					disabled={isGoogleSubmitting}
					onClick={signInWithGoogle}
				>
					{isGoogleSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
					<T>Continue with Google</T>
				</Button>
				<FieldSeparator>
					<T>or</T>
				</FieldSeparator>
				<form action={() => form.handleSubmit()}>
					<FieldGroup>
						{submitError ? <FieldError>{submitError}</FieldError> : null}
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
											setSubmitError(undefined);
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
						{showPassword ? (
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
												setSubmitError(undefined);
												field.handleChange(event.currentTarget.value);
											}}
											required
										/>
									</Field>
								)}
							</form.Field>
						) : null}
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
							{([canSubmit, isSubmitting]) => (
								<Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
									{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
									{showPassword ? <T>Sign in</T> : <T>Send me a link</T>}
								</Button>
							)}
						</form.Subscribe>
						{showPassword ? null : (
							<Button
								type="button"
								variant="outline"
								className="w-full"
								onClick={() => setShowPassword(true)}
							>
								<T>Login with password</T>
							</Button>
						)}
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
