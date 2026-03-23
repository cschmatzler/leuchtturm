export function AuthSidePanel() {
	return (
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
				<p className="font-display text-2xl font-bold text-background/90">Email, refined.</p>
				<p className="mt-2 max-w-xs text-sm leading-relaxed text-background/45">
					A fast, focused email client built for people who value their time.
				</p>
			</div>
		</div>
	);
}
