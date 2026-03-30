import { PaperclipIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useZeroQuery } from "@chevrotain/web/lib/query";
import { sanitizeEmailHtml } from "@chevrotain/web/lib/sanitize-html";
import { queries } from "@chevrotain/zero/queries";
import type { MailMessage } from "@chevrotain/zero/schema";

type EmailAddress = { name?: string; address: string };

interface MessageDetailProps {
	messageId: string;
}

export function MessageDetail({ messageId }: MessageDetailProps) {
	const [bodyParts] = useZeroQuery(queries.mailMessageBodyParts({ messageId }));

	return (
		<div className="flex min-w-0 flex-col gap-4 overflow-x-hidden p-4">
			<MessageBody bodyParts={bodyParts} />
		</div>
	);
}

function MessageBody({
	bodyParts,
}: {
	bodyParts: readonly { contentType: string; content: string; isPreferredRender: boolean }[];
}) {
	const { t } = useTranslation();

	if (bodyParts.length === 0) {
		return <p className="text-sm text-muted-foreground italic">{t("No content")}</p>;
	}

	// Render preferred part (HTML if available, otherwise plain text) — §16
	const preferred = bodyParts.find((p) => p.isPreferredRender) ?? bodyParts[0];

	if (!preferred) {
		return <p className="text-sm text-muted-foreground italic">{t("No content")}</p>;
	}

	if (preferred.contentType === "text/html") {
		return <SanitizedHtml html={preferred.content} />;
	}

	return <pre className="whitespace-pre-wrap text-sm">{preferred.content}</pre>;
}

function SanitizedHtml({ html }: { html: string }) {
	const sanitized = useMemo(() => sanitizeEmailHtml(html), [html]);

	return (
		<div
			className="prose prose-sm dark:prose-invert max-w-none overflow-x-auto"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized client-side via DOMPurify
			dangerouslySetInnerHTML={{ __html: sanitized }}
		/>
	);
}

export function MessageHeader({ message }: { message: MailMessage }) {
	const { t } = useTranslation();
	const sender = message.sender as EmailAddress | null | undefined;
	const toRecipients = (message.toRecipients as EmailAddress[] | null) ?? [];

	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
						{(sender?.name ?? sender?.address ?? "?").charAt(0).toUpperCase()}
					</div>
					<div>
						<p className="text-sm font-medium">{sender?.name ?? sender?.address ?? t("Unknown")}</p>
						{sender?.name && <p className="text-xs text-muted-foreground">{sender.address}</p>}
					</div>
				</div>
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
			{toRecipients.length > 0 && (
				<p className="text-xs text-muted-foreground">
					{t("To")}: {toRecipients.map((r) => r.name ?? r.address).join(", ")}
				</p>
			)}
			{message.hasAttachments && (
				<div className="flex items-center gap-1 text-xs text-muted-foreground">
					<PaperclipIcon className="size-3" />
					{t("Has attachments")}
				</div>
			)}
		</div>
	);
}
