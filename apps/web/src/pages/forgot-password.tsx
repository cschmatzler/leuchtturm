import { createFileRoute, Link } from "@tanstack/react-router";
import { MailIcon } from "lucide-react";

import { AuthSidePanel } from "@chevrotain/web/components/app/auth-side-panel";
import { ForgotPasswordForm } from "@chevrotain/web/pages/forgot-password/-components/forgot-password-form";

export const Route = createFileRoute("/forgot-password")({
	component: Page,
});

function Page() {
	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link
						to="/"
						className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
					>
						<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<MailIcon className="size-4" />
						</div>
						<span className="font-display text-lg font-semibold">Chevrotain</span>
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<ForgotPasswordForm />
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
