import { PaperclipIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { MailMessage } from "@leuchtturm/zero/schema";

interface MessageDetailProps {
	renderKind: "html" | "text";
	content: string;
}

export function MessageDetail({ renderKind, content }: MessageDetailProps) {
	const { t } = useTranslation();

	if (content.length === 0) {
		return (
			<div className="flex min-w-0 flex-col gap-4 overflow-x-hidden p-4">
				<p className="text-sm text-muted-foreground italic">{t("No content")}</p>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col gap-4 overflow-x-hidden p-4">
			{renderKind === "html" ? (
				<div
					className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized during mail ingest on the server.
					dangerouslySetInnerHTML={{ __html: content }}
				/>
			) : (
				<pre className="whitespace-pre-wrap text-sm">{content}</pre>
			)}
		</div>
	);
}

export function MessageHeader({ message }: { message: MailMessage }) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium">{t("Message")}</p>
				{message.receivedAt && (
					<time className="text-xs text-muted-foreground">
						{new Date(message.receivedAt).toLocaleString(undefined, {
							month: "short",
							day: "numeric",
							hour: "numeric",
							minute: "2-digit",
						})}
					</time>
				)}
			</div>
			{message.hasAttachments && (
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<PaperclipIcon className="size-3" />
					{t("Has attachments")}
				</div>
			)}
		</div>
	);
}
