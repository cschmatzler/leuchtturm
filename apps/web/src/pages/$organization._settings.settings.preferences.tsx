import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguage } from "@leuchtturm/core/i18n";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Show } from "@leuchtturm/web/components/ui/flow";
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
import { Skeleton } from "@leuchtturm/web/components/ui/skeleton";
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
	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<PreferencesSection />
			<TwoFactorAuthenticationSection />
		</div>
	);
}

function PreferencesSection() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	const t = useGT();

	const form = useForm({
		defaultValues: {
			language: resolveLanguage(currentUser?.language, DEFAULT_LANGUAGE),
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.updateUser({ language: value.language });
			if (error) {
				toast.error(error.message);
				return;
			}
			toast.success(t("Preferences updated"));
		},
	});

	if (!currentUser) {
		return (
			<section className="space-y-5">
				<div className="space-y-2">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-4 w-44" />
				</div>
				<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
					<div className="space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-56" />
					</div>
					<Skeleton className="h-7 w-[200px]" />
				</div>
			</section>
		);
	}

	return (
		<section>
			<div className="space-y-1">
				<h2 className="font-display text-2xl">
					<T>Preferences</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					<T>Customize your experience.</T>
				</p>
			</div>
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
										if (value) field.handleChange(value);
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
							<Button type="submit" loading={state.isSubmitting} disabled={!state.canSubmit}>
								<T>Save</T>
							</Button>
						</div>
					)}
				</form.Subscribe>
			</form>
		</section>
	);
}

function TwoFactorAuthenticationSection() {
	type Step =
		| "status"
		| "enable-password"
		| "disable-password"
		| "regenerate-password"
		| "setup"
		| "backup";

	const router = useRouter();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const t = useGT();

	const [step, setStep] = useState<Step>("status");
	const passwordForm = useForm({
		defaultValues: {
			password: "",
		},
		onSubmit: async ({ value }) => {
			if (step === "enable-password") {
				const { data, error } = await authClient.twoFactor.enable({
					password: value.password,
					issuer: "Leuchtturm",
				});
				if (error) {
					passwordForm.setFieldMeta("password", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: error.message },
						},
					}));
					return;
				}
				setupForm.setFieldValue("totpURI", data.totpURI);
				setupForm.setFieldValue("secret", new URL(data.totpURI).searchParams.get("secret") ?? "");
				setupForm.setFieldValue("backupCodes", data.backupCodes);
				passwordForm.reset();
				setStep("setup");
				toast.success(t("Scan the authenticator setup code to finish enabling 2FA"));
				return;
			}

			if (step === "disable-password") {
				const { error } = await authClient.twoFactor.disable({ password: value.password });
				if (error) {
					passwordForm.setFieldMeta("password", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: error.message },
						},
					}));
					return;
				}
				passwordForm.reset();
				setupForm.reset();
				setStep("status");
				await router.invalidate();
				toast.success(t("Two-factor authentication disabled"));
				return;
			}

			const { data, error } = await authClient.twoFactor.generateBackupCodes({
				password: value.password,
			});
			if (error) {
				passwordForm.setFieldMeta("password", (previous) => ({
					...previous,
					errorMap: {
						...previous.errorMap,
						onSubmit: { message: error.message },
					},
				}));
				return;
			}
			passwordForm.reset();
			setupForm.setFieldValue("backupCodes", data.backupCodes);
			setStep("backup");
			toast.success(t("Backup codes regenerated"));
		},
	});
	const setupForm = useForm({
		defaultValues: {
			code: "",
			totpURI: "",
			secret: "",
			backupCodes: Array<string>(),
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.twoFactor.verifyTotp({ code: value.code });
			if (error) {
				setupForm.setFieldMeta("code", (previous) => ({
					...previous,
					errorMap: {
						...previous.errorMap,
						onSubmit: { message: error.message },
					},
				}));
				return;
			}
			setupForm.setFieldValue("code", "");
			setStep("backup");
			await router.invalidate();
			toast.success(t("Two-factor authentication enabled"));
		},
	});

	if (!currentUser) {
		return (
			<section className="space-y-5">
				<div className="space-y-2">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-4 w-80" />
				</div>
				<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
					<div className="space-y-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-56" />
					</div>
					<div className="flex justify-end">
						<Skeleton className="h-7 w-20" />
					</div>
				</div>
			</section>
		);
	}

	return (
		<section>
			<div className="space-y-1">
				<h2 className="font-display text-2xl">
					<T>Two-factor authentication</T>
				</h2>
				<p className="text-sm text-muted-foreground">
					<T>Protect your account with an authenticator app and backup codes.</T>
				</p>
			</div>
			<div className="mt-5 space-y-6">
				<Show when={step === "status"}>
					<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
						<div>
							<FieldLabel>
								<T>Status</T>
							</FieldLabel>
							<FieldDescription className="mt-1">
								<Show
									when={currentUser.twoFactorEnabled}
									fallback={<T>Two-factor authentication is disabled.</T>}
								>
									<T>Two-factor authentication is enabled.</T>
								</Show>
							</FieldDescription>
						</div>
						<div className="flex flex-wrap justify-end gap-2">
							<Show
								when={currentUser.twoFactorEnabled}
								fallback={
									<Button type="button" onClick={() => setStep("enable-password")}>
										<T>Enable 2FA</T>
									</Button>
								}
							>
								<Button
									type="button"
									variant="outline"
									onClick={() => setStep("regenerate-password")}
								>
									<T>Regenerate backup codes</T>
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={() => setStep("disable-password")}
								>
									<T>Disable 2FA</T>
								</Button>
							</Show>
						</div>
					</div>
				</Show>
				<Show
					when={
						step === "enable-password" ||
						step === "disable-password" ||
						step === "regenerate-password"
					}
				>
					<form action={() => passwordForm.handleSubmit()} className="space-y-6">
						<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
							<div>
								<FieldLabel htmlFor="two-factor-password">
									<T>Password</T>
								</FieldLabel>
							</div>
							<div>
								<passwordForm.Field
									name="password"
									validators={{
										onSubmit: ({ value }) =>
											value ? undefined : { message: t("Password is required") },
									}}
								>
									{(field) => (
										<>
											<Input
												id="two-factor-password"
												type="password"
												autoComplete="current-password"
												value={field.state.value}
												onInput={(event) => {
													field.handleChange(event.currentTarget.value);
												}}
												className="max-w-sm"
												disabled={passwordForm.state.isSubmitting}
											/>
											<Show when={field.state.meta.isDirty && field.state.meta.errors.length > 0}>
												<FieldError className="mt-2">
													{field.state.meta.errors[0]?.message}
												</FieldError>
											</Show>
										</>
									)}
								</passwordForm.Field>
							</div>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									passwordForm.reset();
									setStep("status");
								}}
								disabled={passwordForm.state.isSubmitting}
							>
								<T>Cancel</T>
							</Button>
							<Button
								type="submit"
								variant={step === "disable-password" ? "destructive" : "default"}
								loading={passwordForm.state.isSubmitting}
							>
								<Show when={step === "enable-password"}>
									<T>Continue</T>
								</Show>
								<Show when={step === "disable-password"}>
									<T>Disable 2FA</T>
								</Show>
								<Show when={step === "regenerate-password"}>
									<T>Regenerate backup codes</T>
								</Show>
							</Button>
						</div>
					</form>
				</Show>
				<Show when={step === "setup"}>
					<form action={() => setupForm.handleSubmit()} className="space-y-6">
						<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
							<div>
								<FieldLabel>
									<T>Authenticator setup</T>
								</FieldLabel>
								<FieldDescription className="mt-1">
									<T>
										Scan this QR code with your authenticator app, then enter the code it shows.
									</T>
								</FieldDescription>
							</div>
							<setupForm.Subscribe
								selector={(state) => ({
									totpURI: state.values.totpURI,
									secret: state.values.secret,
								})}
							>
								{({ totpURI, secret }) => (
									<div className="space-y-3">
										<div className="inline-flex rounded-md border bg-white p-3">
											<QRCodeSVG value={totpURI} size={180} />
										</div>
										<Show when={secret}>
											{(value) => (
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
															value={value}
															className="font-mono"
														/>
														<Button
															type="button"
															variant="outline"
															onClick={() => {
																void navigator.clipboard.writeText(value);
																toast.success(t("Secret key copied"));
															}}
														>
															<T>Copy</T>
														</Button>
													</div>
												</>
											)}
										</Show>
										<setupForm.Field
											name="code"
											validators={{
												onSubmit: ({ value }) =>
													value ? undefined : { message: t("Authentication code is required") },
											}}
										>
											{(field) => (
												<>
													<Input
														id="two-factor-code"
														inputMode="numeric"
														autoComplete="one-time-code"
														placeholder={t("Authentication code")}
														value={field.state.value}
														onInput={(event) => {
															field.handleChange(event.currentTarget.value);
														}}
														disabled={setupForm.state.isSubmitting}
														className="max-w-sm"
													/>
													<Show
														when={field.state.meta.isDirty && field.state.meta.errors.length > 0}
													>
														<FieldError className="mt-2">
															{field.state.meta.errors[0]?.message}
														</FieldError>
													</Show>
												</>
											)}
										</setupForm.Field>
									</div>
								)}
							</setupForm.Subscribe>
						</div>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setupForm.reset();
									setStep("status");
								}}
								disabled={setupForm.state.isSubmitting}
							>
								<T>Cancel</T>
							</Button>
							<setupForm.Subscribe
								selector={(state) => ({
									code: state.values.code,
									isSubmitting: state.isSubmitting,
								})}
							>
								{(state) => (
									<Button type="submit" loading={state.isSubmitting} disabled={!state.code}>
										<T>Verify and enable</T>
									</Button>
								)}
							</setupForm.Subscribe>
						</div>
					</form>
				</Show>
				<Show when={step === "backup"}>
					<setupForm.Subscribe selector={(state) => state.values.backupCodes}>
						{(backupCodes) => (
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
									{backupCodes.map((code) => (
										<div key={code}>{code}</div>
									))}
								</div>
							</div>
						)}
					</setupForm.Subscribe>
				</Show>
			</div>
		</section>
	);
}
