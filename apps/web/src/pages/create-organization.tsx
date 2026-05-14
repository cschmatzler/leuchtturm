import { CaretDownIcon } from "@phosphor-icons/react/CaretDown";
import { SparkleIcon } from "@phosphor-icons/react/Sparkle";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { T, useGT } from "gt-react";
import { useState } from "react";

import { OrganizationInsert } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leuchtturm/web/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@leuchtturm/web/components/ui/field";
import { Show } from "@leuchtturm/web/components/ui/flow";
import { Input } from "@leuchtturm/web/components/ui/input";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/create-organization")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());
		if (!session) throw redirect({ to: "/login" });

		return { session };
	},
	component: Page,
});

function Page() {
	const { session } = Route.useRouteContext();
	const navigate = useNavigate();

	const queryClient = useQueryClient();

	const t = useGT();
	const { deviceSessions, invalidateSessions, setActiveSession, signOutCurrent } = useAuth();

	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [submitError, setSubmitError] = useState<string>();
	const form = useForm({
		defaultValues: {
			name: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const name = Schema.decodeSync(OrganizationInsert.fields.name)(value.name);
			const organization = Schema.decodeSync(
				Schema.Struct({
					name: OrganizationInsert.fields.name,
					slug: OrganizationInsert.fields.slug,
				}),
			)({ name, slug: name.toLowerCase() });
			const { data, error } = await authClient.organization.create(organization);

			if (error) {
				if (
					error.code === "AuthDuplicateOrganizationNameError" ||
					error.code === "ORGANIZATION_ALREADY_EXISTS" ||
					error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
					error.message === "Organization name already exists."
				) {
					form.setFieldMeta("name", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: t("This organization name is already in use.") },
						},
					}));
					return;
				}
				if (
					error.code === "AuthInvalidOrganizationPayloadError" ||
					error.message ===
						"Organization name must contain only ASCII letters, numbers, and dashes."
				) {
					form.setFieldMeta("name", (previous) => ({
						...previous,
						errorMap: {
							...previous.errorMap,
							onSubmit: { message: error.message },
						},
					}));
					return;
				}
				setSubmitError(error.message);
				return;
			}

			await invalidateSessions();
			await queryClient.fetchQuery(organizationsQuery());
			await navigate({
				to: "/$organization/settings",
				params: { organization: data.slug },
			});
		},
	});

	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex items-center justify-between gap-3">
					<Link
						to="/"
						className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
					>
						<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<SparkleIcon className="size-4" />
						</div>
						<span className="text-base font-semibold">Leuchtturm</span>
					</Link>
					<DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
						<DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
							<CaretDownIcon className="mr-2 size-3" />
							{session.user.email}
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{deviceSessions?.map((deviceSession) => (
								<DropdownMenuCheckboxItem
									key={deviceSession.session.id}
									checked={deviceSession.session.token === session.session.token}
									onClick={async () => {
										await setActiveSession(deviceSession.session.token);
										setAccountMenuOpen(false);
									}}
								>
									{deviceSession.user.email}
								</DropdownMenuCheckboxItem>
							))}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									navigate({ to: "/login" });
								}}
							>
								<T>Add account</T>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									signOutCurrent();
								}}
							>
								<T>Log out</T>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
							<div className="flex flex-col gap-2 text-center">
								<h1 className="text-2xl font-serif">
									<T>Create an organization</T>
								</h1>
								<p className="text-balance text-muted-foreground">
									<T>Set up your workspace to get started</T>
								</p>
							</div>
							<FieldGroup>
								<form.Field
									name="name"
									validators={{
										onBlur: Schema.toStandardSchemaV1(OrganizationInsert.fields.name),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>
												<T>Name</T>
											</FieldLabel>
											<Input
												id={field.name}
												name={field.name}
												placeholder={t("Acme")}
												value={field.state.value}
												onBlur={field.handleBlur}
												onInput={(event) => {
													form.setFieldMeta("name", (previous) => ({
														...previous,
														errorMap: {
															...previous.errorMap,
															onSubmit: undefined,
														},
													}));
													setSubmitError(undefined);
													field.handleChange(event.currentTarget.value);
												}}
												required
											/>
											<Show when={field.state.meta.errors.length > 0}>
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											</Show>
										</Field>
									)}
								</form.Field>
								<Show when={submitError}>{(error) => <FieldError>{error}</FieldError>}</Show>
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button
											type="submit"
											className="w-full"
											loading={isSubmitting}
											disabled={!canSubmit}
										>
											<T>Create organization</T>
										</Button>
									)}
								</form.Subscribe>
							</FieldGroup>
						</form>
					</div>
				</div>
			</div>
			<div className="relative hidden overflow-hidden bg-foreground text-background lg:block">
				<div className="pointer-events-none absolute inset-0" aria-hidden="true">
					<div className="animate-glow absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.12] blur-[100px]" />
					<div
						className="absolute inset-0 opacity-[0.035]"
						style={{
							backgroundImage:
								"linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
							backgroundSize: "64px 64px",
						}}
					/>
				</div>
				<div className="absolute inset-0 flex flex-col items-start justify-end p-10">
					<p className="font-serif text-2xl font-bold text-background/90">Focus, refined.</p>
					<p className="mt-2 max-w-xs text-sm leading-relaxed text-background/45">
						A fast, focused app built for people who value their time.
					</p>
				</div>
			</div>
		</div>
	);
}
