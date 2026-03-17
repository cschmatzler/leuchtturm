import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { Schema } from "effect";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { User } from "@chevrotain/core/auth/schema";
import { authClient } from "@chevrotain/web/clients/auth";
import { Button } from "@chevrotain/web/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@chevrotain/web/components/ui/field";
import { Input } from "@chevrotain/web/components/ui/input";

const forgotPasswordShape = Schema.Struct({
	email: User.fields.email,
});

export function ForgotPasswordForm() {
	const { t } = useTranslation();

	const onSubmit = async (value: typeof forgotPasswordShape.Type) => {
		const { error } = await authClient.requestPasswordReset({
			email: value.email,
			redirectTo: `${window.location.origin}/reset-password`,
		});

		if (error) {
			toast.error(error.message);
			return;
		}

		toast.success(t("If an account exists for that email, we sent a reset link."));
	};

	const form = useForm({
		defaultValues: { email: "" },
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
				<h1 className="text-3xl font-bold">{t("Reset your password")}</h1>
				<p className="text-muted-foreground text-balance">
					{t("Enter your email and we'll send you a reset link.")}
				</p>
			</div>
			<FieldGroup>
				<form.Field
					name="email"
					validators={{
						onChange: Schema.toStandardSchemaV1(forgotPasswordShape.fields.email),
					}}
				>
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>{t("Email")}</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								placeholder="m@example.com"
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
				<form.Subscribe selector={(state) => [state.canSubmit]}>
					{([canSubmit]) => (
						<Button type="submit" className="w-full" disabled={!canSubmit}>
							{t("Send reset link")}
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
