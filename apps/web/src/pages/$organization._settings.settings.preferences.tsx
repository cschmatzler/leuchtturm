import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
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

export const Route = createFileRoute("/$organization/_settings/settings/preferences")({
	loader: ({ context: { zero } }) => {
		zero?.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	const t = useGT();
	const currentLanguage = resolveLanguage(currentUser?.language, DEFAULT_LANGUAGE);
	const form = useForm({
		defaultValues: {
			language: currentLanguage,
		},
		onSubmit: async ({ value }) => {
			if (!currentUser) return;
			const { error } = await authClient.updateUser({ language: value.language });
			if (error) throw error;
			toast.success(t("Preferences updated"));
		},
	});

	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section>
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">
						<T>Preferences</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Customize your experience.</T>
					</p>
				</div>
				<form action={submitForm} className="mt-5 space-y-6">
					<form.Field name="language">
						{(field) => (
							<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
								<div>
									<FieldLabel htmlFor={field.name}>
										<T>Language</T>
									</FieldLabel>
									<FieldDescription className="mt-1">
										<T>Select your preferred language for the interface.</T>
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
								<Button
									type="submit"
									disabled={!currentUser || !state.canSubmit || state.isSubmitting}
								>
									{state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
									<T>Save</T>
								</Button>
							</div>
						)}
					</form.Subscribe>
				</form>
			</section>
		</div>
	);
}
