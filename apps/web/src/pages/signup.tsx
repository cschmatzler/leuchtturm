import { createFileRoute } from "@tanstack/react-router";

import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { SignupForm } from "@leuchtturm/web/pages/signup/-components/signup-form";

export const Route = createFileRoute("/signup")({
	component: Page,
});

function Page() {
	return (
		<AuthPageLayout>
			<SignupForm />
		</AuthPageLayout>
	);
}
