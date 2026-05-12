import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T, useGT, Var } from "gt-react";
import { useState } from "react";
import { toast } from "sonner";

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
	const [magicLinkSentTo, setMagicLinkSentTo] = useState<string>();
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
	const [isMagicLinkSubmitting, setIsMagicLinkSubmitting] = useState(false);
	const callbackURL = new URL(redirect ?? "/app", window.location.origin).toString();
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			setMagicLinkSentTo(undefined);
			toast.loading(t("Signing in..."));
			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
			const { error } = await authClient.signIn.email({
				email,
				password: value.password,
			});
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
		},
	});

	const sendMagicLink = async () => {
		setSubmitError(undefined);
		setMagicLinkSentTo(undefined);
		setIsMagicLinkSubmitting(true);
		toast.loading(t("Sending sign-in link..."));
		const email = Schema.decodeSync(UserInsert.fields.email)(form.state.values.email);
		const { error } = await authClient.signIn.magicLink({ email, callbackURL });
		toast.dismiss();
		setIsMagicLinkSubmitting(false);

		if (error) {
			setSubmitError(error.message);
			return;
		}

		setMagicLinkSentTo(email);
		toast.success(t("Sign-in link sent"));
	};

	const signInWithGoogle = async () => {
		setSubmitError(undefined);
		setMagicLinkSentTo(undefined);
		setIsGoogleSubmitting(true);
		toast.loading(t("Signing in..."));
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL,
		});
		toast.dismiss();
		setIsGoogleSubmitting(false);

		if (error) {
			setSubmitError(error.message);
		}
	};

	return (
		<AuthPageLayout>
			<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
				<div className="flex flex-col gap-2 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">
						<T>Welcome back</T>
					</h1>
					<p className="text-balance text-muted-foreground">
						<T>Use your password, or request a magic link that only needs your email.</T>
					</p>
				</div>
				<FieldGroup>
					{submitError ? <FieldError>{submitError}</FieldError> : null}
					{magicLinkSentTo ? (
						<FieldDescription className="text-center">
							<T>
								Check your inbox for a sign-in link sent to <Var>{magicLinkSentTo}</Var>.
							</T>
						</FieldDescription>
					) : null}
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
										setMagicLinkSentTo(undefined);
										field.handleChange(event.currentTarget.value);
									}}
									disabled={isGoogleSubmitting || isMagicLinkSubmitting}
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
									<T>Password for password sign-in</T>
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
										setMagicLinkSentTo(undefined);
										field.handleChange(event.currentTarget.value);
									}}
									disabled={isGoogleSubmitting || isMagicLinkSubmitting}
									required
								/>
								<FieldDescription>
									<T>Required only for the password sign-in button below.</T>
								</FieldDescription>
							</Field>
						)}
					</form.Field>
					<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
						{([canSubmit, isSubmitting]) => (
							<>
								<Button
									type="submit"
									className="w-full"
									disabled={
										!canSubmit || isSubmitting || isGoogleSubmitting || isMagicLinkSubmitting
									}
								>
									{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
									<T>Sign in with password</T>
								</Button>
								<FieldDescription className="text-center">
									<T>Magic link sign-in uses the email above and does not need a password.</T>
								</FieldDescription>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									disabled={isSubmitting || isGoogleSubmitting || isMagicLinkSubmitting}
									onClick={sendMagicLink}
								>
									{isMagicLinkSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
									<T>Email me a magic sign-in link</T>
								</Button>
								<FieldSeparator>
									<T>or</T>
								</FieldSeparator>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									disabled={isSubmitting || isGoogleSubmitting || isMagicLinkSubmitting}
									onClick={signInWithGoogle}
								>
									{isGoogleSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
									<T>Continue with Google</T>
								</Button>
							</>
						)}
					</form.Subscribe>
				</FieldGroup>
				<div className="text-center text-sm">
					<T>Don&apos;t have an account?</T>{" "}
					<Link to="/signup" className="underline underline-offset-4 hover:text-primary">
						<T>Sign up</T>
					</Link>
				</div>
			</form>
		</AuthPageLayout>
	);
}
