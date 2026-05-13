import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { toast } from "sonner";

import { UserInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { FieldDescription, FieldError, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/settings/profile")({
	loader: ({ context: { zero } }) => {
		zero?.preload(queries.currentUser());
	},
	component: Page,
});

function Page() {
	const [currentUser] = useZeroQuery(queries.currentUser());

	const t = useGT();

	const form = useForm({
		defaultValues: {
			name: currentUser?.name ?? "",
		},
		onSubmit: async ({ value }) => {
			if (!currentUser) return;
			const { error } = await authClient.updateUser({
				name: Schema.decodeSync(UserInsert.fields.name)(value.name),
			});
			if (error) throw error;
			toast.success(t("Profile updated"));
		},
	});

	const submitForm = async () => {
		await form.handleSubmit();
	};

	return (
		<div className="mx-auto w-full max-w-3xl">
			<section>
				<div className="space-y-1">
					<h2 className="font-display text-2xl">
						<T>Profile</T>
					</h2>
					<p className="text-sm text-muted-foreground">
						<T>Your personal information.</T>
					</p>
				</div>
				<form action={submitForm} className="mt-5 space-y-6">
					<form.Field
						name="name"
						validators={{
							onBlur: Schema.toStandardSchemaV1(UserInsert.fields.name),
						}}
					>
						{(field) => (
							<div className="grid gap-x-10 gap-y-2 lg:grid-cols-[1fr_2fr]">
								<div>
									<FieldLabel htmlFor={field.name}>
										<T>Name</T>
									</FieldLabel>
									<FieldDescription className="mt-1">
										<T>What you&apos;d like to be called throughout the application.</T>
									</FieldDescription>
								</div>
								<div>
									<Input
										id={field.name}
										name={field.name}
										value={field.state.value}
										onBlur={field.handleBlur}
										onInput={(e) => field.handleChange(e.currentTarget.value)}
										className="max-w-sm"
									/>
									<Show when={!field.state.meta.isValid}>
										<FieldError className="mt-2">{field.state.meta.errors[0]?.message}</FieldError>
									</Show>
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
									loading={state.isSubmitting}
									disabled={!currentUser || !state.canSubmit}
								>
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
