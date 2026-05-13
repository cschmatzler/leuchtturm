import { SpinnerIcon } from "@phosphor-icons/react/Spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { T, useGT } from "gt-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { DEFAULT_LANGUAGE, resolveLanguage, SupportedLanguage } from "@leuchtturm/core/i18n";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Loading } from "@leuchtturm/web/components/app/loading";
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

function isSupportedLanguage(value: string | null): value is typeof SupportedLanguage.Type {
	return SupportedLanguage.literals.some((language) => language === value);
}

type PasswordAction = "enable" | "disable" | "regenerate";

type Setup = {
	totpURI: string;
	secret: string;
	backupCodes: string[];
};

export const Route = createFileRoute("/$organization/_settings/settings/preferences")({
	loader: ({ context: { zero } }) => {
		zero?.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-10">
			<PreferencesForm />
			<TwoFactorAuthenticationForm />
		</div>
	);
}

function PreferencesForm() {
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

	if (!currentUser) return <Loading />;

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
										if (isSupportedLanguage(value)) field.handleChange(value);
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
		</section>
	);
}

function TwoFactorAuthenticationForm() {
	const router = useRouter();

	const [currentUser] = useZeroQuery(queries.currentUser());

	const t = useGT();

	const [passwordAction, setPasswordAction] = useState<PasswordAction>();
	const [setup, setSetup] = useState<Setup>();
	const [backupCodes, setBackupCodes] = useState<string[]>();

	if (!currentUser) return <Loading />;

	async function enableTwoFactor(password: string) {
		const { data, error } = await authClient.twoFactor.enable({
			password,
			issuer: "Leuchtturm",
		});

		if (error) return error.message;

		setPasswordAction(undefined);
		setSetup({
			totpURI: data.totpURI,
			secret: new URL(data.totpURI).searchParams.get("secret") ?? "",
			backupCodes: data.backupCodes,
		});
		setBackupCodes(undefined);
		toast.success(t("Scan the authenticator setup code to finish enabling 2FA"));
	}

	async function verifyTwoFactor(code: string) {
		const { error } = await authClient.twoFactor.verifyTotp({ code });

		if (error) return error.message;

		setBackupCodes(setup?.backupCodes);
		setSetup(undefined);
		await router.invalidate();
		toast.success(t("Two-factor authentication enabled"));
	}

	async function disableTwoFactor(password: string) {
		const { error } = await authClient.twoFactor.disable({ password });

		if (error) return error.message;

		setPasswordAction(undefined);
		setBackupCodes(undefined);
		await router.invalidate();
		toast.success(t("Two-factor authentication disabled"));
	}

	async function regenerateBackupCodes(password: string) {
		const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });

		if (error) return error.message;

		setPasswordAction(undefined);
		setBackupCodes(data.backupCodes);
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
			<div className="mt-5 space-y-6">
				{passwordAction ? (
					<TwoFactorPasswordForm
						action={passwordAction}
						onCancel={() => setPasswordAction(undefined)}
						onSubmit={
							passwordAction === "enable"
								? enableTwoFactor
								: passwordAction === "disable"
									? disableTwoFactor
									: regenerateBackupCodes
						}
					/>
				) : null}
				{setup ? (
					<TwoFactorSetupForm
						setup={setup}
						onCancel={() => setSetup(undefined)}
						onSubmit={verifyTwoFactor}
					/>
				) : null}
				{!passwordAction && !setup ? (
					<>
						<TwoFactorStatus
							enabled={currentUser.twoFactorEnabled}
							onEnable={() => setPasswordAction("enable")}
							onDisable={() => setPasswordAction("disable")}
							onRegenerate={() => setPasswordAction("regenerate")}
						/>
						{backupCodes ? <BackupCodes codes={backupCodes} /> : null}
					</>
				) : null}
			</div>
		</section>
	);
}

function TwoFactorPasswordForm({
	action,
	onCancel,
	onSubmit,
}: {
	action: PasswordAction;
	onCancel: () => void;
	onSubmit: (password: string) => Promise<string | undefined>;
}) {
	const form = useForm({
		defaultValues: {
			password: "",
		},
		onSubmit: async ({ value }) => {
			const error = await onSubmit(value.password);
			if (error) {
				form.setFieldMeta("password", (previous) => ({
					...previous,
					errorMap: {
						...previous.errorMap,
						onSubmit: { message: error },
					},
				}));
				return;
			}
			form.reset();
		},
	});

	return (
		<form action={() => form.handleSubmit()} className="space-y-6">
			<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
				<div>
					<FieldLabel htmlFor="two-factor-password">
						<T>Password</T>
					</FieldLabel>
				</div>
				<div>
					<form.Field
						name="password"
						validators={{
							onSubmit: () => undefined as { message: string } | undefined,
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
										form.setFieldMeta("password", (previous) => ({
											...previous,
											errorMap: {
												...previous.errorMap,
												onSubmit: undefined,
											},
										}));
										field.handleChange(event.currentTarget.value);
									}}
									className="max-w-sm"
									disabled={form.state.isSubmitting}
								/>
								{field.state.meta.errors.length > 0 ? (
									<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
								) : null}
							</>
						)}
					</form.Field>
				</div>
			</div>
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={form.state.isSubmitting}
				>
					<T>Cancel</T>
				</Button>
				<Button
					type="submit"
					variant={action === "disable" ? "destructive" : "default"}
					disabled={form.state.isSubmitting}
				>
					{form.state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
					{action === "enable" ? <T>Continue</T> : null}
					{action === "disable" ? <T>Disable 2FA</T> : null}
					{action === "regenerate" ? <T>Regenerate backup codes</T> : null}
				</Button>
			</div>
		</form>
	);
}

function TwoFactorSetupForm({
	setup,
	onCancel,
	onSubmit,
}: {
	setup: Setup;
	onCancel: () => void;
	onSubmit: (code: string) => Promise<string | undefined>;
}) {
	const t = useGT();

	const form = useForm({
		defaultValues: {
			code: "",
		},
		onSubmit: async ({ value }) => {
			const error = await onSubmit(value.code);
			if (error) {
				form.setFieldMeta("code", (previous) => ({
					...previous,
					errorMap: {
						...previous.errorMap,
						onSubmit: { message: error },
					},
				}));
				return;
			}
			form.reset();
		},
	});

	return (
		<form action={() => form.handleSubmit()} className="space-y-6">
			<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
				<div>
					<FieldLabel>
						<T>Authenticator setup</T>
					</FieldLabel>
					<FieldDescription className="mt-1">
						<T>Scan this QR code with your authenticator app, then enter the code it shows.</T>
					</FieldDescription>
				</div>
				<div className="space-y-3">
					<div className="inline-flex rounded-md border bg-white p-3">
						<QRCodeSVG value={setup.totpURI} size={180} />
					</div>
					{setup.secret ? (
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
									value={setup.secret}
									className="font-mono"
								/>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										void navigator.clipboard.writeText(setup.secret);
										toast.success(t("Secret key copied"));
									}}
								>
									<T>Copy</T>
								</Button>
							</div>
						</>
					) : null}
					<form.Field
						name="code"
						validators={{
							onSubmit: () => undefined as { message: string } | undefined,
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
										form.setFieldMeta("code", (previous) => ({
											...previous,
											errorMap: {
												...previous.errorMap,
												onSubmit: undefined,
											},
										}));
										field.handleChange(event.currentTarget.value);
									}}
									disabled={form.state.isSubmitting}
									className="max-w-sm"
								/>
								{field.state.meta.errors.length > 0 ? (
									<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
								) : null}
							</>
						)}
					</form.Field>
				</div>
			</div>
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={form.state.isSubmitting}
				>
					<T>Cancel</T>
				</Button>
				<form.Subscribe
					selector={(state) => ({
						code: state.values.code,
						isSubmitting: state.isSubmitting,
					})}
				>
					{(state) => (
						<Button type="submit" disabled={!state.code || state.isSubmitting}>
							{state.isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
							<T>Verify and enable</T>
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

function TwoFactorStatus({
	enabled,
	onEnable,
	onDisable,
	onRegenerate,
}: {
	enabled: boolean;
	onEnable: () => void;
	onDisable: () => void;
	onRegenerate: () => void;
}) {
	return (
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
						<Button type="button" variant="outline" onClick={onRegenerate}>
							<T>Regenerate backup codes</T>
						</Button>
						<Button type="button" variant="destructive" onClick={onDisable}>
							<T>Disable 2FA</T>
						</Button>
					</>
				) : (
					<Button type="button" onClick={onEnable}>
						<T>Enable 2FA</T>
					</Button>
				)}
			</div>
		</div>
	);
}

function BackupCodes({ codes }: { codes: string[] }) {
	return (
		<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
			<div>
				<FieldLabel>
					<T>Backup codes</T>
				</FieldLabel>
				<FieldDescription className="mt-1">
					<T>Save these codes now. Each code can be used once if you lose your authenticator.</T>
				</FieldDescription>
			</div>
			<div className="grid max-w-sm grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
				{codes.map((code) => (
					<div key={code}>{code}</div>
				))}
			</div>
		</div>
	);
}
