import { SpinnerIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { useTranslation } from "@leuchtturm/web/clients/i18n";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldError } from "@leuchtturm/web/components/ui/field";

export function SignupForm() {
	const { t } = useTranslation();
	const [submitError, setSubmitError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const signUpWithGoogle = async () => {
		setSubmitError(undefined);
		setIsSubmitting(true);
		toast.loading(t("Creating account..."));
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: new URL("/app", window.location.origin).toString(),
		});
		toast.dismiss();
		setIsSubmitting(false);

		if (error) {
			setSubmitError(error.message);
		}
	};

	return (
		<form action={signUpWithGoogle} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Create an account")}</h1>
				<p className="text-balance text-muted-foreground">
					{t("Sign up with Google to create your account")}
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
				{t("Already have an account?")}{" "}
				<Link to="/login" className="underline underline-offset-4 hover:text-primary">
					{t("Sign in")}
				</Link>
			</div>
		</form>
	);
}
