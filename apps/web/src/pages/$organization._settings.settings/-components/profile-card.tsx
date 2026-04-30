import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { User } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export function ProfileCard() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	const { t } = useTranslation();

	const form = useForm({
		defaultValues: {
			name: currentUser?.name ?? "",
		},
		onSubmit: async ({ value }) => {
			if (!currentUser) return;
			const { error } = await authClient.updateUser({
				name: Schema.decodeSync(User.fields.name)(value.name),
			});
			if (error) throw error;
			toast.success(t("Profile updated"));
		},
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<section>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{t("Profile")}</h2>
				<p className="text-sm text-muted-foreground">{t("Your personal information.")}</p>
			</div>
			<form action={submitForm} className="mt-5 space-y-6">
				<form.Field
					name="name"
					validators={{
						onBlur: Schema.toStandardSchemaV1(User.fields.name),
					}}
				>
					{(field) => (
						<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
							<div>
								<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
								<FieldDescription className="mt-1">
									{t("What you'd like to be called throughout the application.")}
								</FieldDescription>
							</div>
							<div>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onInput={(e) => field.handleChange(e.currentTarget.value)}
									className="max-w-sm"
								/>
								{!field.state.meta.isValid && (
									<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
								)}
							</div>
						</div>
					)}
				</form.Field>
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => (
						<div className="flex justify-end">
							<Button
								type="submit"
								disabled={!currentUser || !state.canSubmit || state.isSubmitting}
							>
								{state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
								{t("Save")}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}
