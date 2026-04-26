import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Schema } from "effect";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Password } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";

export function ResetPasswordForm() {
	const navigate = useNavigate();
	const { token } = useSearch({ from: "/reset-password" });
	const { t } = useTranslation();

	const form = useForm({
		defaultValues: {
			password: "",
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.resetPassword({
				token,
				newPassword: Schema.decodeSync(Password)(value.password),
			});

			if (error) {
				toast.error(error.message);
				return;
			}

			toast.success(t("Password updated. Please log in."));
			navigate({ to: "/login" });
		},
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<form action={submitForm} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">{t("Set a new password")}</h1>
				<p className="text-muted-foreground text-balance">
					{t("Enter a new password for your account.")}
				</p>
			</div>

			<FieldGroup>
				<form.Field
					name="password"
					validators={{
						onBlur: Schema.toStandardSchemaV1(Password),
					}}
				>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>{t("New password")}</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(e) => field.handleChange(e.currentTarget.value)}
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
						<Button type="submit" className="w-full" disabled={!canSubmit}>
							{isSubmitting ? t("Updating password...") : t("Update password")}
						</Button>
					)}
				</form.Subscribe>
			</FieldGroup>

			<div className="text-center text-sm">
				<Link to="/login" className="underline underline-offset-4 hover:text-primary">
					{t("Back to login")}
				</Link>
			</div>
		</form>
	);
}
