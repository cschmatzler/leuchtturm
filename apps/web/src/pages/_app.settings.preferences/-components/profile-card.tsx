import { useForm } from "@tanstack/react-form";
import { Schema } from "effect";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { User } from "@leuchtturm/core/auth/schema";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import {
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useZero, useZeroQuery } from "@leuchtturm/web/lib/query";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";

const profileShape = Schema.Struct({
	name: User.fields.name,
});

export function ProfileCard() {
	const zero = useZero();
	const { t } = useTranslation();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const onSubmit = async (value: typeof profileShape.Type) => {
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
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="px-6 py-5">
				<CardTitle className="text-base">{t("Profile")}</CardTitle>
				<CardDescription>{t("Your personal information.")}</CardDescription>
			</CardHeader>
			<form action={submitForm}>
				<FieldGroup>
					<CardContent className="border-t border-border px-6 py-5">
						<form.Field
							name="name"
							validators={{
								onChange: Schema.toStandardSchemaV1(profileShape.fields.name),
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
											<FieldError className="mt-2">
												{field.state.meta.errors[0]?.message}
											</FieldError>
										)}
									</div>
								</div>
							)}
						</form.Field>
					</CardContent>
					<form.Subscribe
						selector={(state) => ({
							canSubmit: state.canSubmit,
							isSubmitting: state.isSubmitting,
						})}
					>
						{(state) => (
							<CardFooter className="justify-end border-t border-border bg-muted/30 px-6 py-4">
								<Button type="submit" disabled={!currentUser || !state.canSubmit}>
									{state.isSubmitting ? <Loader2Icon className="size-4 animate-spin" /> : t("Save")}
								</Button>
							</CardFooter>
						)}
					</form.Subscribe>
				</FieldGroup>
			</form>
		</Card>
	);
}
