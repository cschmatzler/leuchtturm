import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguage } from "@leuchtturm/core/i18n";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Input } from "@leuchtturm/web/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@leuchtturm/web/components/ui/select";
import { Separator } from "@leuchtturm/web/components/ui/separator";
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

type TwoFactorAction = "idle" | "enable" | "setup" | "disable" | "regenerate";

export const Route = createFileRoute("/$organization/_settings/settings/preferences")({
	loader: ({ context: { zero } }) => {
		zero?.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	if (!currentUser) {
		return (
			<div className="mx-auto flex w-full max-w-3xl justify-center py-10">
				<SpinnerIcon className="size-5 animate-spin" />
			</div>
		);
	}

	const currentLanguage = resolveLanguage(currentUser.language, DEFAULT_LANGUAGE);

	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<PreferencesSection currentLanguage={currentLanguage} />
			<TwoFactorAuthenticationForm enabled={currentUser.twoFactorEnabled ?? false} />
		</div>
	);
}

function PreferencesSection({
	currentLanguage,
}: {
	currentLanguage: typeof SupportedLanguage.Type;
}) {
	return (
		<section>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">
					<T>Preferences</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					<T>Customize your experience.</T>
				</p>
			</div>
			<PreferencesForm currentLanguage={currentLanguage} />
		</section>
	);
}

function PreferencesForm({ currentLanguage }: { currentLanguage: typeof SupportedLanguage.Type }) {
	const t = useGT();

	const form = useForm({
		defaultValues: {
			language: currentLanguage,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.updateUser({ language: value.language });
			if (error) throw error;
			toast.success(t("Preferences updated"));
		},
	});

	return (
		<form action={() => form.handleSubmit()} className="mt-5 space-y-6">
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
						<Button type="submit" disabled={!state.canSubmit || state.isSubmitting}>
							{state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
							<T>Save</T>
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}

function TwoFactorAuthenticationForm({ enabled }: { enabled: boolean }) {
	const router = useRouter();

	const t = useGT();

	const form = useForm({
		defaultValues: {
			action: "idle" as TwoFactorAction,
			password: "",
			code: "",
			totpURI: "",
			secret: "",
			backupCodes: [] as string[],
		},
		validators: {
			onSubmit: () => undefined as string | undefined,
		},
		onSubmit: async ({ value }) => {
			if (value.action === "enable") await enableTwoFactor(value.password);
			if (value.action === "setup") await verifyTwoFactor(value.code, value.backupCodes);
			if (value.action === "disable") await disableTwoFactor(value.password);
			if (value.action === "regenerate") await regenerateBackupCodes(value.password);
		},
	});

	async function enableTwoFactor(password: string) {
		form.setErrorMap({ onSubmit: undefined });
		const { data, error } = await authClient.twoFactor.enable({
			password,
			issuer: "Leuchtturm",
		});

		if (error) {
			form.setErrorMap({
				onSubmit: error.message ?? t("Could not update two-factor authentication"),
			});
			return;
		}

		form.setFieldValue("action", "setup");
		form.setFieldValue("password", "");
		form.setFieldValue("code", "");
		form.setFieldValue("totpURI", data.totpURI);
		form.setFieldValue("secret", new URL(data.totpURI).searchParams.get("secret") ?? "");
		form.setFieldValue("backupCodes", data.backupCodes);
		toast.success(t("Scan the authenticator setup code to finish enabling 2FA"));
	}

	async function verifyTwoFactor(code: string, backupCodes: string[]) {
		form.setErrorMap({ onSubmit: undefined });
		const { error } = await authClient.twoFactor.verifyTotp({ code });

		if (error) {
			form.setErrorMap({
				onSubmit: error.message ?? t("Could not update two-factor authentication"),
			});
			return;
		}

		form.setFieldValue("action", "idle");
		form.setFieldValue("password", "");
		form.setFieldValue("code", "");
		form.setFieldValue("totpURI", "");
		form.setFieldValue("secret", "");
		form.setFieldValue("backupCodes", backupCodes);
		await router.invalidate();
		toast.success(t("Two-factor authentication enabled"));
	}

	async function disableTwoFactor(password: string) {
		form.setErrorMap({ onSubmit: undefined });
		const { error } = await authClient.twoFactor.disable({ password });

		if (error) {
			form.setErrorMap({
				onSubmit: error.message ?? t("Could not update two-factor authentication"),
			});
			return;
		}

		form.setFieldValue("action", "idle");
		form.setFieldValue("password", "");
		form.setFieldValue("backupCodes", []);
		await router.invalidate();
		toast.success(t("Two-factor authentication disabled"));
	}

	async function regenerateBackupCodes(password: string) {
		form.setErrorMap({ onSubmit: undefined });
		const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });

		if (error) {
			form.setErrorMap({
				onSubmit: error.message ?? t("Could not update two-factor authentication"),
			});
			return;
		}

		form.setFieldValue("action", "idle");
		form.setFieldValue("password", "");
		form.setFieldValue("backupCodes", data.backupCodes);
		toast.success(t("Backup codes regenerated"));
	}

	return (
		<section>
			<div className="space-y-1">
				<h2 className="text-lg font-semibold">
					<T>Two-factor authentication</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					<T>Protect your account with an authenticator app and backup codes.</T>
				</p>
			</div>
			<form action={() => form.handleSubmit()} className="mt-5 space-y-6">
				<form.Subscribe
					selector={(state) => ({
						values: state.values,
						error: state.errorMap.onSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ values, error, isSubmitting }) => (
						<>
							{values.action === "enable" ||
							values.action === "disable" ||
							values.action === "regenerate" ? (
								<>
									<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
										<div>
											<FieldLabel htmlFor="two-factor-password">
												<T>Password</T>
											</FieldLabel>
										</div>
										<div>
											<form.Field name="password">
												{(field) => (
													<Input
														id="two-factor-password"
														type="password"
														autoComplete="current-password"
														value={field.state.value}
														onInput={(event) => {
															form.setErrorMap({ onSubmit: undefined });
															field.handleChange(event.currentTarget.value);
														}}
														className="max-w-sm"
														disabled={isSubmitting}
													/>
												)}
											</form.Field>
											{error ? <FieldError className="mt-2">{String(error)}</FieldError> : null}
										</div>
									</div>
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												form.setErrorMap({ onSubmit: undefined });
												form.setFieldValue("action", "idle");
												form.setFieldValue("password", "");
											}}
											disabled={isSubmitting}
										>
											<T>Cancel</T>
										</Button>
										<Button
											type="submit"
											variant={values.action === "disable" ? "destructive" : "default"}
											disabled={isSubmitting}
										>
											{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
											{values.action === "enable" ? <T>Continue</T> : null}
											{values.action === "regenerate" ? <T>Regenerate backup codes</T> : null}
											{values.action === "disable" ? <T>Disable 2FA</T> : null}
										</Button>
									</div>
								</>
							) : null}
							{values.action === "setup" ? (
								<>
									<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
										<div>
											<FieldLabel>
												<T>Authenticator setup</T>
											</FieldLabel>
											<FieldDescription className="mt-1">
												<T>
													Scan this QR code with your authenticator app, then enter the code it
													shows.
												</T>
											</FieldDescription>
										</div>
										<div className="space-y-3">
											<div className="inline-flex rounded-md border bg-white p-3">
												<QRCodeSVG value={values.totpURI} size={180} />
											</div>
											{values.secret ? (
												<>
													<div className="flex max-w-sm items-center gap-3 text-xs text-muted-foreground">
														<Separator />
														<span>
															<T>or</T>
														</span>
														<Separator />
													</div>
													<div className="flex max-w-sm gap-2">
														<Input
															readOnly
															aria-label={t("Secret key")}
															value={values.secret}
															className="font-mono"
														/>
														<Button
															type="button"
															variant="outline"
															onClick={() => {
																void navigator.clipboard.writeText(values.secret);
																toast.success(t("Secret key copied"));
															}}
														>
															<T>Copy</T>
														</Button>
													</div>
												</>
											) : null}
											<form.Field name="code">
												{(field) => (
													<Input
														id="two-factor-code"
														inputMode="numeric"
														autoComplete="one-time-code"
														placeholder={t("Authentication code")}
														value={field.state.value}
														onInput={(event) => {
															form.setErrorMap({ onSubmit: undefined });
															field.handleChange(event.currentTarget.value);
														}}
														disabled={isSubmitting}
														className="max-w-sm"
													/>
												)}
											</form.Field>
											{error ? <FieldError className="mt-2">{String(error)}</FieldError> : null}
										</div>
									</div>
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => {
												form.setErrorMap({ onSubmit: undefined });
												form.setFieldValue("action", "idle");
												form.setFieldValue("code", "");
												form.setFieldValue("totpURI", "");
												form.setFieldValue("secret", "");
												form.setFieldValue("backupCodes", []);
											}}
											disabled={isSubmitting}
										>
											<T>Cancel</T>
										</Button>
										<Button type="submit" disabled={!values.code || isSubmitting}>
											{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
											<T>Verify and enable</T>
										</Button>
									</div>
								</>
							) : null}
							{values.action === "idle" ? (
								<>
									<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
										<div>
											<FieldLabel>
												<T>Status</T>
											</FieldLabel>
											<FieldDescription className="mt-1">
												{enabled ? (
													<T>Two-factor authentication is enabled.</T>
												) : (
													<T>Two-factor authentication is disabled.</T>
												)}
											</FieldDescription>
										</div>
										<div className="flex flex-wrap justify-end gap-2">
											{enabled ? (
												<>
													<Button
														type="button"
														variant="outline"
														onClick={() => {
															form.setErrorMap({ onSubmit: undefined });
															form.setFieldValue("action", "regenerate");
														}}
														disabled={isSubmitting}
													>
														<T>Regenerate backup codes</T>
													</Button>
													<Button
														type="button"
														variant="destructive"
														onClick={() => {
															form.setErrorMap({ onSubmit: undefined });
															form.setFieldValue("action", "disable");
														}}
														disabled={isSubmitting}
													>
														<T>Disable 2FA</T>
													</Button>
												</>
											) : (
												<Button
													type="button"
													onClick={() => {
														form.setErrorMap({ onSubmit: undefined });
														form.setFieldValue("action", "enable");
													}}
													disabled={isSubmitting}
												>
													<T>Enable 2FA</T>
												</Button>
											)}
										</div>
									</div>
									{values.backupCodes.length > 0 ? (
										<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
											<div>
												<FieldLabel>
													<T>Backup codes</T>
												</FieldLabel>
												<FieldDescription className="mt-1">
													<T>
														Save these codes now. Each code can be used once if you lose your
														authenticator.
													</T>
												</FieldDescription>
											</div>
											<div className="grid max-w-sm grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
												{values.backupCodes.map((code) => (
													<div key={code}>{code}</div>
												))}
											</div>
										</div>
									) : null}
								</>
							) : null}
						</>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}
