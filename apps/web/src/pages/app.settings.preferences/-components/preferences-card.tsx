import { useForm } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@chevrotain/web/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@chevrotain/web/components/ui/card";
import { FieldDescription, FieldGroup, FieldLabel } from "@chevrotain/web/components/ui/field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@chevrotain/web/components/ui/select";
import { useZero, useZeroQuery } from "@chevrotain/web/lib/query";
import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";

export function PreferencesCard() {
	const zero = useZero();
	const { i18n, t } = useTranslation();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const form = useForm({
		defaultValues: {
			language: currentUser?.language || "en",
		},
		onSubmit: async ({ value }) => {
			if (!currentUser) return;
			if (value.language !== currentUser.language) {
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

	const items = [
		{ value: "en", label: "English" },
		{ value: "de", label: "Deutsch" },
		{ value: "es", label: "Español" },
		{ value: "fr", label: "Français" },
		{ value: "it", label: "Italiano" },
		{ value: "sq", label: "Shqip" },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("Preferences")}</CardTitle>
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
						<form.Field name="language">
							{(field) => {
								return (
									<div className="grid gap-x-8 gap-y-2 lg:grid-cols-3">
										<div className="lg:col-span-1">
											<FieldLabel htmlFor={field.name}>{t("Language")}</FieldLabel>
											<FieldDescription className="mt-1">
												{t("Select your preferred language for the interface.")}
											</FieldDescription>
										</div>
										<div className="lg:col-span-2">
											<Select
												name={field.name}
												onValueChange={(value) => {
													if (value !== null) field.handleChange(value);
												}}
												value={field.state.value}
												items={items}
											>
												<SelectTrigger className="w-[200px]">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														{items.map((item) => (
															<SelectItem key={item.value} value={item.value}>
																{item.label}
															</SelectItem>
														))}
													</SelectGroup>
												</SelectContent>
											</Select>
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
