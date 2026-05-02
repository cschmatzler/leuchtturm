import { SpinnerIcon } from "@phosphor-icons/react";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldError } from "@leuchtturm/web/components/ui/field";

export function LoginForm() {
	const { t } = useTranslation();
	const { redirect } = useSearch({ from: "/login" });
	const [submitError, setSubmitError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const signInWithGoogle = async () => {
		setSubmitError(undefined);
		setIsSubmitting(true);
		toast.loading(t("Signing in..."));
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: redirect ?? "/app",
		});
		toast.dismiss();
		setIsSubmitting(false);

		if (error) {
			setSubmitError(error.message);
		}
	};

	return (
		<form action={signInWithGoogle} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Welcome back")}</h1>
				<p className="text-balance text-muted-foreground">
					{t("Sign in with Google to continue to your account")}
				</p>
			</div>
			<div className="flex flex-col gap-3">
				{submitError ? <FieldError>{submitError}</FieldError> : null}
				<Button type="submit" className="w-full" disabled={isSubmitting}>
					{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
					{t("Continue with Google")}
				</Button>
			</div>
			<div className="text-center text-sm">
				{t("Don't have an account?")}{" "}
				<Link to="/signup" className="underline underline-offset-4 hover:text-primary">
					{t("Sign up")}
				</Link>
			</div>
		</form>
	);
}
