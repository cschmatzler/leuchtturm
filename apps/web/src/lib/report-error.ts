import posthog from "posthog-js";
import { toast } from "sonner";

export function reportError(
	error: unknown,
	message: string,
	properties: Record<string, unknown> = {},
) {
	if (import.meta.env.DEV) {
		console.error(error);
	}

	posthog.captureException(error, {
		...properties,
		message,
	});

	toast.error(message);
}
