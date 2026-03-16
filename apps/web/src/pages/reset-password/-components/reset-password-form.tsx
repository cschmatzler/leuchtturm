import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { type } from "arktype";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Account } from "@one/core/auth/schema";
import { authClient } from "@one/web/clients/auth";
import { Button } from "@one/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@one/web/components/ui/field";
import { Input } from "@one/web/components/ui/input";

export function ResetPasswordForm() {
	const navigate = useNavigate();
	const { token } = useSearch({ from: "/reset-password" });
	const { t } = useTranslation();

	const shape = type({
		password: Account.get("password").exclude("null"),
	});

	const onSubmit = async (value: typeof shape.infer) => {
		const { error } = await authClient.resetPassword({
			token,
			newPassword: value.password,
		});

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success(t("Password updated. Please log in."));
		navigate({ to: "/login" });
	};

	const form = useForm({
		defaultValues: {
			password: "",
		},
		onSubmit: ({ value }) => onSubmit(value),
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="flex flex-col gap-6"
		>
			<div className="flex flex-col gap-2 text-center">
				<h1 className="text-3xl font-bold">{t("Set a new password")}</h1>
				<p className="text-muted-foreground text-balance">
					{t("Enter a new password for your account.")}
				</p>
			</div>

			<FieldGroup>
				<form.Field
					name="password"
					validators={{
						onChange: shape.get("password"),
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
								<FieldError>{t("Password must be more than 12 characters")}</FieldError>
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
