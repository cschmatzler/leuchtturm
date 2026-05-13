import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { T } from "gt-react";
import { useState } from "react";

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

export const Route = createFileRoute("/two-factor")({
	component: Page,
});

function Page() {
	const navigate = useNavigate();
	const router = useRouter();

	const queryClient = useQueryClient();

	const [useBackupCode, setUseBackupCode] = useState(false);

	const form = useForm({
		defaultValues: {
			code: "",
			trustDevice: false,
		},
		validators: {
			onSubmitAsync: async ({ value }) => {
				const { error } = useBackupCode
					? await authClient.twoFactor.verifyBackupCode({
							code: value.code,
							trustDevice: value.trustDevice,
						})
					: await authClient.twoFactor.verifyTotp({
							code: value.code,
							trustDevice: value.trustDevice,
						});

				if (error) return error.message;
				return null;
			},
		},
		onSubmit: async () => {
			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: ["organizations"] });
			await router.invalidate();
			await navigate({ to: "/app" });
		},
	});

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
										<Show when={useBackupCode} fallback={<T>Authentication code</T>}>
											<T>Backup code</T>
										</Show>
									</FieldLabel>
									<Input
										id={field.name}
										name={field.name}
										inputMode={useBackupCode ? "text" : "numeric"}
										autoComplete="one-time-code"
										value={field.state.value}
										onBlur={field.handleBlur}
										onInput={(event) => {
											form.setErrorMap({ onSubmit: undefined });
											field.handleChange(event.currentTarget.value);
										}}
										required
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="trustDevice">
							{(field) => (
								<Field className="flex-row items-start gap-3">
									<Input
										id={field.name}
										name={field.name}
										type="checkbox"
										checked={field.state.value}
										onChange={(event) => field.handleChange(event.currentTarget.checked)}
										className="mt-1 size-4"
									/>
									<div className="space-y-1">
										<FieldLabel htmlFor={field.name}>
											<T>Trust this device</T>
										</FieldLabel>
										<FieldDescription>
											<T>Skip two-factor prompts on this device for 30 days.</T>
										</FieldDescription>
									</div>
								</Field>
							)}
						</form.Field>
						<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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
						</form.Subscribe>
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={() => {
								form.setErrorMap({ onSubmit: undefined });
								setUseBackupCode((value) => !value);
							}}
						>
							<Show when={useBackupCode} fallback={<T>Use backup code</T>}>
								<T>Use authenticator code</T>
							</Show>
						</Button>
					</FieldGroup>
				</form>
			</div>
		</AuthPageLayout>
	);
}
