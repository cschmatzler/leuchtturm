import { MailIcon } from "lucide-react";

export function AuthSidePanel() {
	return (
		<div className="relative hidden overflow-hidden bg-muted lg:block">
			<div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
			<div
				className="absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			/>
			<div className="absolute inset-0 flex items-center justify-center p-12">
				<div className="flex max-w-sm flex-col items-center gap-4 text-center">
					<div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<MailIcon className="size-8" />
					</div>
					<p className="font-display text-2xl font-semibold text-foreground/80">Email, refined.</p>
					<p className="text-sm text-muted-foreground">
						A fast, focused email client built for people who value their time.
					</p>
				</div>
			</div>
		</div>
	);
}
