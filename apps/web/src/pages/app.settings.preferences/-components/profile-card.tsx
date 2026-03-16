import { useForm } from "@tanstack/react-form";
import { type } from "arktype";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { User } from "@one/core/auth/schema";
import { Button } from "@one/web/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@one/web/components/ui/card";
import { FieldDescription, FieldError, FieldGroup, FieldLabel } from "@one/web/components/ui/field";
import { Input } from "@one/web/components/ui/input";
import { useZero, useZeroQuery } from "@one/web/lib/query";
import { mutators } from "@one/zero/mutators";
import { queries } from "@one/zero/queries";

export function ProfileCard() {
	const zero = useZero();
	const { t } = useTranslation();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const shape = type({
		name: User.get("name"),
	});

	const onSubmit = async (value: typeof shape.infer) => {
		if (!currentUser) return;
		zero.mutate(mutators.user.update({ id: currentUser.id, name: value.name }));
		toast.success(t("Profile updated"));
	};

	const form = useForm({
		defaultValues: {
			name: currentUser?.name ?? "",
		},
		onSubmit: ({ value }) => onSubmit(value),
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("Profile")}</CardTitle>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field
							name="name"
							validators={{
								onChange: shape.get("name"),
							}}
						>
							{(field) => {
								return (
									<div className="grid gap-x-8 gap-y-2 lg:grid-cols-3">
										<div className="lg:col-span-1">
											<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
											<FieldDescription className="mt-1">
												{t("What you'd like to be called throughout the application.")}
											</FieldDescription>
										</div>
										<div className="lg:col-span-2">
											<Input
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(e) => field.handleChange(e.currentTarget.value)}
												className="max-w-md"
											/>
											{!field.state.meta.isValid && (
												<FieldError className="mt-2">
													{String(field.state.meta.errors[0])}
												</FieldError>
											)}
										</div>
									</div>
								);
							}}
						</form.Field>
						<form.Subscribe
							selector={(state) => ({
								canSubmit: state.canSubmit,
								isSubmitting: state.isSubmitting,
								errors: state.errors,
							})}
						>
							{(state) => {
								return (
									<div className="flex justify-end">
										<Button type="submit" disabled={!currentUser || !state.canSubmit}>
											{state.isSubmitting ? (
												<Loader2Icon className="size-4 animate-spin" />
											) : (
												t("Save")
											)}
										</Button>
									</div>
								);
							}}
						</form.Subscribe>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
