import { createFileRoute } from "@tanstack/react-router";

import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { ForgotPasswordForm } from "@leuchtturm/web/pages/forgot-password/-components/forgot-password-form";

export const Route = createFileRoute("/forgot-password")({
	component: Page,
});

function Page() {
	return (
		<AuthPageLayout>
			<ForgotPasswordForm />
		</AuthPageLayout>
	);
}
