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
	const [isTwoFactorSubmitting, setIsTwoFactorSubmitting] = useState(false);
	const [totpURI, setTotpURI] = useState<string>();
	const [backupCodes, setBackupCodes] = useState<string[]>();
	const isCredentialAccount = accounts?.some((account) => account.providerId === "credential");
	const isTwoFactorEnabled = twoFactorEnabled ?? Boolean(currentUser?.twoFactorEnabled);
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
		setBackupCodes(data.backupCodes);
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
		setTwoFactorPassword("");
		setTwoFactorCode("");
		setTotpURI(undefined);
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
		setTwoFactorPassword("");
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
						<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
							<div>
								<FieldLabel htmlFor="two-factor-password">
									<T>Password</T>
								</FieldLabel>
								<FieldDescription className="mt-1">
									<T>Required for accounts that sign in with a password.</T>
								</FieldDescription>
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
								{twoFactorError ? <FieldError className="mt-2">{twoFactorError}</FieldError> : null}
							</div>
						</div>
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
										<Input
											id="two-factor-code"
											inputMode="numeric"
											autoComplete="one-time-code"
											placeholder={t("Authentication code")}
											value={twoFactorCode}
											onInput={(event) => setTwoFactorCode(event.currentTarget.value)}
											disabled={isTwoFactorSubmitting}
											className="max-w-sm"
										/>
									</div>
								</div>
								<div className="flex justify-end gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setTotpURI(undefined);
											setBackupCodes(undefined);
										}}
										disabled={isTwoFactorSubmitting}
									>
										<T>Cancel</T>
									</Button>
									<Button type="button" onClick={verifyTwoFactor} disabled={!twoFactorCode}>
										{isTwoFactorSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
										<T>Verify and enable</T>
									</Button>
								</div>
							</>
						) : (
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
								<div className="flex flex-wrap gap-2">
									{isTwoFactorEnabled ? (
										<>
											<Button
												type="button"
												variant="outline"
												onClick={regenerateBackupCodes}
												disabled={!currentUser || isTwoFactorSubmitting}
											>
												<T>Regenerate backup codes</T>
											</Button>
											<Button
												type="button"
												variant="destructive"
												onClick={disableTwoFactor}
												disabled={!currentUser || isTwoFactorSubmitting}
											>
												<T>Disable 2FA</T>
											</Button>
										</>
									) : (
										<Button
											type="button"
											onClick={enableTwoFactor}
											disabled={!currentUser || isTwoFactorSubmitting}
										>
											{isTwoFactorSubmitting ? (
												<SpinnerIcon className="size-4 animate-spin" />
											) : null}
											<T>Enable 2FA</T>
										</Button>
									)}
								</div>
							</div>
						)}
						{backupCodes ? (
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
