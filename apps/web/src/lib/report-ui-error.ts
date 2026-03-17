import { toast } from "sonner";

import { sendErrorReport } from "@one/web/lib/analytics";

export function reportUiError({ error, message }: { error: unknown; message: string }) {
	if (import.meta.env.DEV) {
		console.error(error);
	}

	toast.error(message);

	const errorType = error instanceof Error ? error.name : "CaughtError";
	const errorMessage = error instanceof Error ? error.message : String(error);
	const stackTrace = error instanceof Error ? error.stack : undefined;

	sendErrorReport(errorType, errorMessage, stackTrace, { userMessage: message });
}
