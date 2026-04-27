import { useForm } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguage } from "@leuchtturm/core/i18n";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { FieldDescription, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leuchtturm/web/components/ui/select";
import { useZero, useZeroQuery } from "@leuchtturm/web/lib/query";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";

const LANGUAGE_LABELS = {
	en: "English",
	de: "Deutsch",
	es: "Español",
	fr: "Français",
	it: "Italiano",
	sq: "Shqip",
} satisfies Record<typeof SupportedLanguage.Type, string>;

const LANGUAGE_ITEMS = SupportedLanguage.literals.map((value) => ({
	value,
	label: LANGUAGE_LABELS[value],
}));

export function PreferencesCard() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	const zero = useZero();
	const { i18n, t } = useTranslation();

	const currentLanguage = resolveLanguage(currentUser?.language, DEFAULT_LANGUAGE);

	const form = useForm({
		defaultValues: {
			language: currentLanguage,
		},
		onSubmit: async ({ value }) => {
			if (!currentUser) return;
			if (value.language !== currentLanguage) {
				await i18n.changeLanguage(value.language);
			}
			zero.mutate(
				mutators.user.update({
					id: currentUser.id,
					language: value.language,
				}),
			);
			toast.success(t("Preferences updated"));
		},
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="px-6 py-5">
				<CardTitle className="text-base">{t("Preferences")}</CardTitle>
				<CardDescription>{t("Customize your experience.")}</CardDescription>
			</CardHeader>
			<form action={submitForm}>
				<FieldGroup>
					<CardContent className="border-t border-border px-6 py-5">
						<form.Field name="language">
							{(field) => (
								<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
									<div>
										<FieldLabel htmlFor={field.name}>{t("Language")}</FieldLabel>
										<FieldDescription className="mt-1">
											{t("Select your preferred language for the interface.")}
										</FieldDescription>
									</div>
									<div>
										<Select
											name={field.name}
											onValueChange={(value) => {
												if (value !== null) field.handleChange(value);
											}}
											value={field.state.value}
											items={LANGUAGE_ITEMS}
										>
											<SelectTrigger id={field.name} className="w-[200px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													{LANGUAGE_ITEMS.map((item) => (
														<SelectItem key={item.value} value={item.value}>
															{item.label}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
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
