import { createFileRoute, Link } from "@tanstack/react-router";
import { type } from "arktype";
import { useTranslation } from "react-i18next";

import { ResetPasswordForm } from "@one/web/pages/reset-password/-components/reset-password-form";

const searchSchema = type({
	token: "string",
});

export const Route = createFileRoute("/reset-password")({
	validateSearch: searchSchema,
	component: Page,
});

function Page() {
	const { t } = useTranslation();

	return (
		<div className="grid min-h-svh w-full lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link to="/" className="flex items-center gap-2 font-medium">
						Sixth Coffee
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<ResetPasswordForm />
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				<img
					src="https://images.unsplash.com/photo-1561986810-4f3ba2f46ceb?q=80&w=4608&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
					alt={t("Coffee")}
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	);
}
