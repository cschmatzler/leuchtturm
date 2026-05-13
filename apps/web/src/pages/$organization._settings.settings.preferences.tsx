import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
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

export const Route = createFileRoute("/$organization/_settings/settings/preferences")({
	loader: ({ context: { zero } }) => {
		zero?.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	const router = useRouter();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const { data: accounts } = useQuery({
		queryKey: ["authAccounts"],
		queryFn: async () => {
			const { data, error } = await authClient.listAccounts();
			if (error) throw error;
			return data;
		},
	});

	const t = useGT();
	const currentLanguage = resolveLanguage(currentUser?.language, DEFAULT_LANGUAGE);
	const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>();
	const [twoFactorPassword, setTwoFactorPassword] = useState("");
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [twoFactorError, setTwoFactorError] = useState<string>();
	const [twoFactorAction, setTwoFactorAction] = useState<"enable" | "disable" | "regenerate">();
	const [isTwoFactorSubmitting, setIsTwoFactorSubmitting] = useState(false);
	const [totpURI, setTotpURI] = useState<string>();
	const [pendingBackupCodes, setPendingBackupCodes] = useState<string[]>();
	const [backupCodes, setBackupCodes] = useState<string[]>();
	const isCredentialAccount = accounts?.some((account) => account.providerId === "credential");
	const isTwoFactorEnabled = twoFactorEnabled ?? Boolean(currentUser?.twoFactorEnabled);
	const totpSecret = totpURI ? new URL(totpURI).searchParams.get("secret") : undefined;
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

	const enableTwoFactor = async () => {
		setTwoFactorError(undefined);
		setIsTwoFactorSubmitting(true);
		const { data, error } = await authClient.twoFactor.enable({
			password: twoFactorPassword || undefined,
			issuer: "Leuchtturm",
		});
		setIsTwoFactorSubmitting(false);

		if (error) {
			setTwoFactorError(error.message);
			return;
		}

		setTotpURI(data.totpURI);
		setTwoFactorPassword("");
		setPendingBackupCodes(data.backupCodes);
		setBackupCodes(undefined);
		toast.success(t("Scan the authenticator setup code to finish enabling 2FA"));
	};

	const verifyTwoFactor = async () => {
		setTwoFactorError(undefined);
		setIsTwoFactorSubmitting(true);
		const { error } = await authClient.twoFactor.verifyTotp({ code: twoFactorCode });
		setIsTwoFactorSubmitting(false);

		if (error) {
			setTwoFactorError(error.message);
			return;
		}

		setTwoFactorEnabled(true);
		setTwoFactorAction(undefined);
		setTwoFactorPassword("");
		setTwoFactorCode("");
		setTotpURI(undefined);
		setBackupCodes(pendingBackupCodes);
		setPendingBackupCodes(undefined);
		await router.invalidate();
		toast.success(t("Two-factor authentication enabled"));
	};

	const disableTwoFactor = async () => {
		setTwoFactorError(undefined);
		setIsTwoFactorSubmitting(true);
		const { error } = await authClient.twoFactor.disable({
			password: twoFactorPassword || undefined,
		});
		setIsTwoFactorSubmitting(false);

		if (error) {
			setTwoFactorError(error.message);
			return;
		}

		setTwoFactorEnabled(false);
		setTwoFactorAction(undefined);
		setTwoFactorPassword("");
		setPendingBackupCodes(undefined);
		setBackupCodes(undefined);
		await router.invalidate();
		toast.success(t("Two-factor authentication disabled"));
	};

	const regenerateBackupCodes = async () => {
		setTwoFactorError(undefined);
		setIsTwoFactorSubmitting(true);
		const { data, error } = await authClient.twoFactor.generateBackupCodes({
			password: twoFactorPassword || undefined,
		});
		setIsTwoFactorSubmitting(false);

		if (error) {
			setTwoFactorError(error.message);
			return;
		}

		setBackupCodes(data.backupCodes);
		setTwoFactorAction(undefined);
		setTwoFactorPassword("");
		toast.success(t("Backup codes regenerated"));
	};

	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
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
			{isCredentialAccount ? (
				<section>
					<div className="space-y-1">
						<h2 className="text-lg font-semibold">
							<T>Two-factor authentication</T>
						</h2>
						<p className="text-sm text-muted-foreground">
							<T>Protect your account with an authenticator app and backup codes.</T>
						</p>
					</div>
					<div className="mt-5 space-y-6">
						{twoFactorAction && !totpURI ? (
							<>
								<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
									<div>
										<FieldLabel htmlFor="two-factor-password">
											<T>Password</T>
										</FieldLabel>
									</div>
									<div>
										<Input
											id="two-factor-password"
											type="password"
											autoComplete="current-password"
											value={twoFactorPassword}
											onInput={(event) => setTwoFactorPassword(event.currentTarget.value)}
											className="max-w-sm"
											disabled={!currentUser || isTwoFactorSubmitting}
										/>
										{twoFactorError ? (
											<FieldError className="mt-2">{twoFactorError}</FieldError>
										) : null}
									</div>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setTwoFactorAction(undefined);
											setTwoFactorPassword("");
											setTwoFactorError(undefined);
										}}
										disabled={isTwoFactorSubmitting}
									>
										<T>Cancel</T>
									</Button>
									{twoFactorAction === "enable" ? (
										<Button
											type="button"
											onClick={enableTwoFactor}
											disabled={!currentUser || isTwoFactorSubmitting}
										>
											{isTwoFactorSubmitting ? (
												<SpinnerIcon className="size-4 animate-spin" />
											) : null}
											<T>Continue</T>
										</Button>
									) : null}
									{twoFactorAction === "regenerate" ? (
										<Button
											type="button"
											onClick={regenerateBackupCodes}
											disabled={!currentUser || isTwoFactorSubmitting}
										>
											{isTwoFactorSubmitting ? (
												<SpinnerIcon className="size-4 animate-spin" />
											) : null}
											<T>Regenerate backup codes</T>
										</Button>
									) : null}
									{twoFactorAction === "disable" ? (
										<Button
											type="button"
											variant="destructive"
											onClick={disableTwoFactor}
											disabled={!currentUser || isTwoFactorSubmitting}
										>
											{isTwoFactorSubmitting ? (
												<SpinnerIcon className="size-4 animate-spin" />
											) : null}
											<T>Disable 2FA</T>
										</Button>
									) : null}
								</div>
							</>
						) : null}
						{totpURI ? (
							<>
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
									<div className="space-y-3">
										<div className="inline-flex rounded-md border bg-white p-3">
											<QRCodeSVG value={totpURI} size={180} />
										</div>
										{totpSecret ? (
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
														value={totpSecret}
														className="font-mono"
													/>
													<Button
														type="button"
														variant="outline"
														onClick={() => {
															void navigator.clipboard.writeText(totpSecret);
															toast.success(t("Secret key copied"));
														}}
													>
														<T>Copy</T>
													</Button>
												</div>
											</>
										) : null}
										<Input
											id="two-factor-code"
											inputMode="numeric"
											autoComplete="one-time-code"
											placeholder={t("Authentication code")}
											value={twoFactorCode}
											onInput={(event) => {
												setTwoFactorError(undefined);
												setTwoFactorCode(event.currentTarget.value);
											}}
											disabled={isTwoFactorSubmitting}
											className="max-w-sm"
										/>
										{twoFactorError ? (
											<FieldError className="mt-2">{twoFactorError}</FieldError>
										) : null}
									</div>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setTwoFactorAction(undefined);
											setTwoFactorCode("");
											setTwoFactorError(undefined);
											setTotpURI(undefined);
											setPendingBackupCodes(undefined);
										}}
										disabled={isTwoFactorSubmitting}
									>
										<T>Cancel</T>
									</Button>
									<Button
										type="button"
										onClick={verifyTwoFactor}
										disabled={!twoFactorCode || isTwoFactorSubmitting}
									>
										{isTwoFactorSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
										<T>Verify and enable</T>
									</Button>
								</div>
							</>
						) : !twoFactorAction ? (
							<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
								<div>
									<FieldLabel>
										<T>Status</T>
									</FieldLabel>
									<FieldDescription className="mt-1">
										{isTwoFactorEnabled ? (
											<T>Two-factor authentication is enabled.</T>
										) : (
											<T>Two-factor authentication is disabled.</T>
										)}
									</FieldDescription>
								</div>
								<div className="flex flex-wrap justify-end gap-2">
									{isTwoFactorEnabled ? (
										<>
											<Button
												type="button"
												variant="outline"
												onClick={() => {
													setTwoFactorAction("regenerate");
													setTwoFactorError(undefined);
												}}
												disabled={!currentUser || isTwoFactorSubmitting}
											>
												<T>Regenerate backup codes</T>
											</Button>
											<Button
												type="button"
												variant="destructive"
												onClick={() => {
													setTwoFactorAction("disable");
													setTwoFactorError(undefined);
												}}
												disabled={!currentUser || isTwoFactorSubmitting}
											>
												<T>Disable 2FA</T>
											</Button>
										</>
									) : (
										<Button
											type="button"
											onClick={() => {
												setTwoFactorAction("enable");
												setTwoFactorError(undefined);
											}}
											disabled={!currentUser || isTwoFactorSubmitting}
										>
											<T>Enable 2FA</T>
										</Button>
									)}
								</div>
							</div>
						) : null}
						{backupCodes && !twoFactorAction && !totpURI ? (
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
						) : null}
					</div>
				</section>
			) : null}
		</div>
	);
}
