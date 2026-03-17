import { Skeleton } from "@chevrotain/web/components/ui/skeleton";

export function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="flex min-h-svh w-full flex-col items-center justify-center gap-4"
		>
			<span className="sr-only">Loading</span>
			<Skeleton className="h-4 w-64" />
			<Skeleton className="h-4 w-32" />
			<Skeleton className="h-4 w-64" />
		</div>
	);
}
