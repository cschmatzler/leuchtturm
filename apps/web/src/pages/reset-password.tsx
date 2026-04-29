import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";

import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { ResetPasswordForm } from "@leuchtturm/web/pages/reset-password/-components/reset-password-form";

export const Route = createFileRoute("/reset-password")({
	validateSearch: Schema.toStandardSchemaV1(
		Schema.Struct({
			token: Schema.String,
		}),
	),
	component: Page,
});

function Page() {
	return (
		<AuthPageLayout>
			<ResetPasswordForm />
		</AuthPageLayout>
	);
}
