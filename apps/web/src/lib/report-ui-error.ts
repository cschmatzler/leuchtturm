import { toast } from "sonner";

export function reportUiError({ error, message }: { error: unknown; message: string }) {
	if (import.meta.env.DEV) {
		console.error(error);
	}

	toast.error(message);
}
