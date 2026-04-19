import { createFileRoute, Link } from "@tanstack/react-router";
import { Schema } from "effect";
import { SparklesIcon } from "lucide-react";

import { AuthSidePanel } from "@leuchtturm/web/components/app/auth-side-panel";
import { ResetPasswordForm } from "@leuchtturm/web/pages/reset-password/-components/reset-password-form";

const searchSchema = Schema.Struct({
	token: Schema.String,
});

export const Route = createFileRoute("/reset-password")({
	validateSearch: Schema.toStandardSchemaV1(searchSchema),
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
							<SparklesIcon className="size-4" />
						</div>
						<span className="text-base font-semibold">Leuchtturm</span>
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md">
						<ResetPasswordForm />
					</div>
				</div>
			</div>
			<AuthSidePanel />
		</div>
	);
}
