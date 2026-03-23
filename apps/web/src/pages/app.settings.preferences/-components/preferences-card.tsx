import { useForm } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@chevrotain/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@chevrotain/web/components/ui/card";
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
		<Card className="gap-0 overflow-hidden p-0">
			<CardHeader className="px-6 py-5">
				<CardTitle className="text-base">{t("Preferences")}</CardTitle>
				<CardDescription>{t("Customize your experience.")}</CardDescription>
			</CardHeader>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
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
