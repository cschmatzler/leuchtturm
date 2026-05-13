import { useForm } from "@tanstack/react-form";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { T } from "gt-react";

import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@leuchtturm/web/components/ui/field";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";
import { Toggle } from "@leuchtturm/web/components/ui/toggle";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";

export const Route = createFileRoute("/two-factor")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			backup: Schema.Boolean.pipe(
				Schema.optional,
				Schema.withDecodingDefault(Effect.succeed(false)),
			),
		}),
	),
	search: {
		middlewares: [stripSearchParams({ backup: false })],
	},
	component: Page,
});

function Page() {
	const search = Route.useSearch();

	return (
		<AuthPageLayout>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2 text-center">
					<h1 className="font-display text-3xl">
						<T>Two-factor authentication</T>
					</h1>
					<p className="text-balance text-muted-foreground">
						<T>Enter the code from your authenticator app to finish signing in.</T>
					</p>
				</div>
				<Show when={search.backup} fallback={<TotpForm />}>
					<BackupCodeForm />
				</Show>
			</div>
		</AuthPageLayout>
	);
}

function TotpForm() {
	const navigate = useNavigate();

	const { invalidateSessions } = useAuth();

	const form = useForm({
		defaultValues: {
			code: "",
			trustDevice: false,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.twoFactor.verifyTotp({
				code: value.code,
				trustDevice: value.trustDevice,
			});

			if (error) {
				form.setErrorMap({ onSubmit: { form: error.message, fields: {} } });
				return;
			}

			await invalidateSessions();
			await navigate({ to: "/app" });
		},
	});

	return (
		<form action={() => form.handleSubmit()}>
			<FieldGroup>
				<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
					{(formError) => (
						<Show when={formError}>{(error) => <FieldError>{String(error)}</FieldError>}</Show>
					)}
				</form.Subscribe>
				<form.Field name="code">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>
								<T>Authentication code</T>
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								inputMode="numeric"
								autoComplete="one-time-code"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(event) => {
									field.handleChange(event.currentTarget.value);
								}}
								required
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="trustDevice">
					{(field) => (
						<Field>
							<Toggle
								id={field.name}
								pressed={field.state.value}
								onPressedChange={field.handleChange}
								variant="outline"
								className="w-fit"
							>
								<T>Trust this device</T>
							</Toggle>
							<FieldDescription>
								<T>Skip two-factor prompts on this device for 30 days.</T>
							</FieldDescription>
						</Field>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" className="w-full" loading={isSubmitting} disabled={!canSubmit}>
							<T>Verify</T>
						</Button>
					)}
				</form.Subscribe>
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => {
						form.setErrorMap({ onSubmit: undefined });
						void navigate({ to: "/two-factor", search: { backup: true } });
					}}
				>
					<T>Use backup code</T>
				</Button>
			</FieldGroup>
		</form>
	);
}

function BackupCodeForm() {
	const navigate = useNavigate();

	const { invalidateSessions } = useAuth();

	const form = useForm({
		defaultValues: {
			code: "",
			trustDevice: false,
		},
		onSubmit: async ({ value }) => {
			const { error } = await authClient.twoFactor.verifyBackupCode({
				code: value.code,
				trustDevice: value.trustDevice,
			});

			if (error) {
				form.setErrorMap({ onSubmit: { form: error.message, fields: {} } });
				return;
			}

			await invalidateSessions();
			await navigate({ to: "/app" });
		},
	});

	return (
		<form action={() => form.handleSubmit()}>
			<FieldGroup>
				<form.Subscribe selector={(state) => state.errorMap.onSubmit}>
					{(formError) => (
						<Show when={formError}>{(error) => <FieldError>{String(error)}</FieldError>}</Show>
					)}
				</form.Subscribe>
				<form.Field name="code">
					{(field) => (
						<Field>
							<FieldLabel htmlFor={field.name}>
								<T>Backup code</T>
							</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								inputMode="text"
								autoComplete="one-time-code"
								value={field.state.value}
								onBlur={field.handleBlur}
								onInput={(event) => {
									field.handleChange(event.currentTarget.value);
								}}
								required
							/>
						</Field>
					)}
				</form.Field>
				<form.Field name="trustDevice">
					{(field) => (
						<Field>
							<Toggle
								id={field.name}
								pressed={field.state.value}
								onPressedChange={field.handleChange}
								variant="outline"
								className="w-fit"
							>
								<T>Trust this device</T>
							</Toggle>
							<FieldDescription>
								<T>Skip two-factor prompts on this device for 30 days.</T>
							</FieldDescription>
						</Field>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
					{([canSubmit, isSubmitting]) => (
						<Button type="submit" className="w-full" loading={isSubmitting} disabled={!canSubmit}>
							<T>Verify</T>
						</Button>
					)}
				</form.Subscribe>
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => {
						form.setErrorMap({ onSubmit: undefined });
						void navigate({ to: "/two-factor", search: { backup: false } });
					}}
				>
					<T>Use authenticator code</T>
				</Button>
			</FieldGroup>
		</form>
	);
}
