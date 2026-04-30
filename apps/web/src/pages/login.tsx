import { createFileRoute } from "@tanstack/react-router";

import { AuthPageLayout } from "@leuchtturm/web/components/app/auth-page-layout";
import { LoginForm } from "@leuchtturm/web/pages/login/-components/login-form";

export const Route = createFileRoute("/login")({
	validateSearch: (search) => {
		if (
			typeof search.redirect === "string" &&
			search.redirect.startsWith("/") &&
			!search.redirect.startsWith("//")
		) {
			return { redirect: search.redirect };
		}

		return {};
	},
	component: Page,
});

function Page() {
	return (
		<AuthPageLayout>
			<LoginForm />
		</AuthPageLayout>
	);
}
