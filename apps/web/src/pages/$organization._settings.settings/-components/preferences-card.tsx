import { SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguage } from "@leuchtturm/core/i18n";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldLabel } from "@leuchtturm/web/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leuchtturm/web/components/ui/select";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
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
			const { error } = await authClient.updateUser({ language: value.language });
			if (error) throw error;
			toast.success(t("Preferences updated"));
		},
	});
	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<section>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">{t("Preferences")}</h2>
				<p className="text-sm text-muted-foreground">{t("Customize your experience.")}</p>
			</div>
			<form action={submitForm} className="mt-5 space-y-6">
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
				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => (
						<div className="flex justify-end">
							<Button type="submit" disabled={!currentUser || !state.canSubmit}>
								{state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : t("Save")}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}
