import { SparklesIcon } from "lucide-react";

export function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="flex min-h-svh w-full flex-col items-center justify-center gap-4"
		>
			<span className="sr-only">Loading</span>
			<div className="flex size-10 animate-pulse items-center justify-center rounded-xl bg-primary/10 text-primary">
				<SparklesIcon className="size-5" />
			</div>
			<div className="flex flex-col items-center gap-2">
				<div className="h-2 w-48 animate-pulse rounded-full bg-muted" />
				<div className="h-2 w-24 animate-pulse rounded-full bg-muted" />
			</div>
		</div>
	);
}
