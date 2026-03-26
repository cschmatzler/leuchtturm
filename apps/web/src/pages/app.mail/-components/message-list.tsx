import { InboxIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@chevrotain/web/lib/cn";
import type { MailMessageRow } from "@chevrotain/zero/schema";

type EmailAddress = { name?: string; address: string };

interface MessageListProps {
	messages: readonly MailMessageRow[];
	onSelect: (messageId: string) => void;
}

export function MessageList({ messages, onSelect }: MessageListProps) {
	const { t } = useTranslation();

	if (messages.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
				<InboxIcon className="size-10 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">{t("No messages")}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col divide-y divide-border overflow-y-auto">
			{messages.map((message) => {
				const sender = message.sender as EmailAddress | null | undefined;
				const senderDisplay = sender?.name ?? sender?.address ?? t("Unknown");

				return (
					<button
						key={message.id}
						type="button"
						className="flex flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent"
						onClick={() => onSelect(message.id)}
					>
						<div className="flex items-center justify-between gap-2">
							<span
								className={cn(
									"truncate text-sm",
									message.isUnread ? "font-semibold" : "font-medium",
								)}
							>
								{senderDisplay}
							</span>
							{message.receivedAt && (
								<span className="shrink-0 text-xs text-muted-foreground">
									{formatRelativeTime(message.receivedAt)}
								</span>
							)}
						</div>
						<span className={cn("truncate text-sm", message.isUnread && "font-medium")}>
							{message.subject ?? t("(No subject)")}
						</span>
						{message.snippet && (
							<p className="truncate text-xs text-muted-foreground">{message.snippet}</p>
						)}
					</button>
				);
			})}
		</div>
	);
}

function formatRelativeTime(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (days === 0) {
		return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	}
	if (days === 1) return "Yesterday";
	if (days < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
