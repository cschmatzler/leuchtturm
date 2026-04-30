import { CaretDownIcon, SparkleIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Organization } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { AuthSidePanel } from "@leuchtturm/web/components/app/auth-side-panel";
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
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation();
	const { deviceSessions, setActiveSession, signOutCurrent } = useAuth();
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [submitError, setSubmitError] = useState<string>();

	const form = useForm({
		defaultValues: {
			name: "",
		},
		onSubmit: async ({ value }) => {
			setSubmitError(undefined);
			const name = Schema.decodeSync(Organization.fields.name)(value.name);
			const organization = Schema.decodeSync(
				Organization.mapFields(({ name, slug }) => ({ name, slug })),
			)({ name, slug: name.toLowerCase() });
			const { data, error } = await authClient.organization.create(organization);

			if (error) {
				if (
					error.code === "AuthDuplicateOrganizationNameError" ||
					error.code === "ORGANIZATION_ALREADY_EXISTS" ||
					error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN" ||
					error.message === "Organization name already exists"
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
					error.message === "Organization name must contain only ASCII letters, numbers, and dashes"
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

			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: organizationsQuery().queryKey });
			await queryClient.fetchQuery(organizationsQuery());
			await router.invalidate();
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
									void navigate({ to: "/login" });
								}}
							>
								{t("Add account")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									void signOutCurrent();
								}}
							>
								{t("Log out")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<form action={() => form.handleSubmit()} className="flex flex-col gap-6">
							<div className="flex flex-col gap-2 text-center">
								<h1 className="text-2xl font-semibold tracking-tight">
									{t("Create an organization")}
								</h1>
								<p className="text-balance text-muted-foreground">
									{t("Set up your workspace to get started")}
								</p>
							</div>
							<FieldGroup>
								<form.Field
									name="name"
									validators={{
										onBlur: Schema.toStandardSchemaV1(Organization.fields.name),
									}}
								>
									{(field) => (
										<Field>
											<FieldLabel htmlFor={field.name}>{t("Name")}</FieldLabel>
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
											{field.state.meta.errors.length > 0 && (
												<FieldError>{field.state.meta.errors[0]?.message}</FieldError>
											)}
										</Field>
									)}
								</form.Field>
								{submitError ? <FieldError>{submitError}</FieldError> : null}
								<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
									{([canSubmit, isSubmitting]) => (
										<Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
											{isSubmitting ? <SpinnerIcon className="size-4 animate-spin" /> : null}
											{t("Create organization")}
										</Button>
									)}
								</form.Subscribe>
							</FieldGroup>
						</form>
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
