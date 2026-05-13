import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
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
import { Switch } from "@leuchtturm/web/components/ui/switch";
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
	const navigate = useNavigate();

	const { invalidateSessions } = useAuth();

	const totpForm = useForm({
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
				totpForm.setErrorMap({ onSubmit: { form: error.message, fields: {} } });
				return;
			}

			await invalidateSessions();
			await navigate({ to: "/app" });
		},
	});
	const backupCodeForm = useForm({
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
				backupCodeForm.setErrorMap({ onSubmit: { form: error.message, fields: {} } });
				return;
			}

			await invalidateSessions();
			await navigate({ to: "/app" });
		},
	});

	return (
		<AuthPageLayout>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<h1 className="font-display text-3xl">
						<T>Two-factor authentication</T>
					</h1>
					<p className="text-sm text-muted-foreground">
						<T>Enter the code from your authenticator app to finish signing in.</T>
					</p>
				</div>
				<Show
					when={search.backup}
					fallback={
						<form action={() => totpForm.handleSubmit()}>
							<FieldGroup>
								<totpForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
									{(formError) => (
										<Show when={formError}>
											{(error) => <FieldError>{String(error)}</FieldError>}
										</Show>
									)}
								</totpForm.Subscribe>
								<totpForm.Field name="code">
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
								</totpForm.Field>
								<totpForm.Field name="trustDevice">
									{(field) => (
										<Field className="flex-row items-start gap-3">
											<Switch
												id={field.name}
												aria-labelledby={`${field.name}-label`}
												checked={field.state.value}
												onCheckedChange={field.handleChange}
												className="mt-1"
											/>
											<div className="space-y-1">
												<FieldLabel id={`${field.name}-label`}>
													<T>Trust this device</T>
												</FieldLabel>
												<FieldDescription>
													<T>Skip two-factor prompts on this device for 30 days.</T>
												</FieldDescription>
											</div>
										</Field>
									)}
								</totpForm.Field>
								<totpForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button
											type="submit"
											className="w-full"
											loading={isSubmitting}
											disabled={!canSubmit}
										>
											<T>Verify</T>
										</Button>
									)}
								</totpForm.Subscribe>
								<div className="text-center text-sm">
									<Link
										to="/two-factor"
										search={{ backup: true }}
										className="underline underline-offset-4 hover:text-primary"
									>
										<T>Use backup code</T>
									</Link>
								</div>
							</FieldGroup>
						</form>
					}
				>
					<form action={() => backupCodeForm.handleSubmit()}>
						<FieldGroup>
							<backupCodeForm.Subscribe selector={(state) => state.errorMap.onSubmit}>
								{(formError) => (
									<Show when={formError}>
										{(error) => <FieldError>{String(error)}</FieldError>}
									</Show>
								)}
							</backupCodeForm.Subscribe>
							<backupCodeForm.Field name="code">
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
							</backupCodeForm.Field>
							<backupCodeForm.Field name="trustDevice">
								{(field) => (
									<Field className="flex-row items-start gap-3">
										<Switch
											id={field.name}
											aria-labelledby={`${field.name}-label`}
											checked={field.state.value}
											onCheckedChange={field.handleChange}
											className="mt-1"
										/>
										<div className="space-y-1">
											<FieldLabel id={`${field.name}-label`}>
												<T>Trust this device</T>
											</FieldLabel>
											<FieldDescription>
												<T>Skip two-factor prompts on this device for 30 days.</T>
											</FieldDescription>
										</div>
									</Field>
								)}
							</backupCodeForm.Field>
							<backupCodeForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
								{([canSubmit, isSubmitting]) => (
									<Button
										type="submit"
										className="w-full"
										loading={isSubmitting}
										disabled={!canSubmit}
									>
										<T>Verify</T>
									</Button>
								)}
							</backupCodeForm.Subscribe>
							<div className="text-center text-sm">
								<Link
									to="/two-factor"
									search={{ backup: false }}
									className="underline underline-offset-4 hover:text-primary"
								>
									<T>Use authenticator code</T>
								</Link>
							</div>
						</FieldGroup>
					</form>
				</Show>
			</div>
		</AuthPageLayout>
	);
}
