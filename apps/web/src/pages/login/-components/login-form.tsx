import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { Link, useSearch } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { toast } from "sonner";

import { UserInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { useTranslation } from "@leuchtturm/web/clients/i18n";
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

export function LoginForm() {
	const { t } = useTranslation();
	const { redirect } = useSearch({ from: "/login" });
	const [submitError, setSubmitError] = useState<string>();
	const [magicLinkSentTo, setMagicLinkSentTo] = useState<string>();
	const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
	const callbackURL = new URL(redirect ?? "/app", window.location.origin).toString();
	const form = useForm({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			setMagicLinkSentTo(undefined);
			toast.loading(t("Sending sign-in link..."));
			const email = Schema.decodeSync(UserInsert.fields.email)(value.email);
			const { error } = await authClient.signIn.magicLink({ email });
			toast.dismiss();

			if (error) {
				setSubmitError(error.message);
				return;
			}

			setMagicLinkSentTo(email);
			toast.success(t("Sign-in link sent"));
		},
	});

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
		<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Welcome back")}</h1>
				<p className="text-balance text-muted-foreground">
					{t("Sign in with your email or Google to continue to your account")}
				</p>
			</div>
			<FieldGroup>
				{submitError ? <FieldError>{submitError}</FieldError> : null}
				{magicLinkSentTo ? (
					<FieldDescription className="text-center">
						{t("Check your inbox for a sign-in link sent to {{email}}.", {
							email: magicLinkSentTo,
						})}
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
							<FieldLabel htmlFor={field.name}>{t("Email")}</FieldLabel>
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
								disabled={isGoogleSubmitting}
								required
							/>
							{field.state.meta.errors.length > 0 && (
								<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
							)}
						</Field>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<>
							<Button
								type="submit"
								className="w-full"
								disabled={!canSubmit || isSubmitting || isGoogleSubmitting}
							>
								{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
								{t("Send sign-in link")}
							</Button>
							<FieldSeparator>{t("or")}</FieldSeparator>
							<Button
								type="button"
								variant="outline"
								className="w-full"
								disabled={isSubmitting || isGoogleSubmitting}
								onClick={signInWithGoogle}
							>
								{isGoogleSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
								{t("Continue with Google")}
							</Button>
						</>
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
	);
}
