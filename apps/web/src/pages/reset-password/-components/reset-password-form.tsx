import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Password } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";

export function ResetPasswordForm() {
	const { token } = useSearch({ from: "/reset-password" });
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: {
			password: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const { error } = await authClient.resetPassword({
				token,
				newPassword: Schema.decodeSync(Password)(value.password),
			});

			if (error) {
				if (error.code === "INVALID_PASSWORD") {
					form.setFieldMeta("password", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: error.message },
						},
					}));
					return;
				}
				setSubmitError(error.message);
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
								onInput={(e) => {
									form.setFieldMeta("password", (previous) => ({
										...previous,
										errorMap: {
											...previous.errorMap,
											onSubmit: undefined,
										},
									}));
									setSubmitError(undefined);
									field.handleChange(e.currentTarget.value);
								}}
								required
							/>
							{field.state.meta.errors.length > 0 && (
								<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
							)}
						</Field>
					)}
				</form.Field>
				{submitError ? <FieldError>{submitError}</FieldError> : null}

				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
							{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
							{t("Update password")}
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
