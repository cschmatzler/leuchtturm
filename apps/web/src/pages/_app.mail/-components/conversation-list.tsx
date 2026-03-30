import { InboxIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@chevrotain/web/lib/cn";
import type { MailConversation } from "@chevrotain/zero/schema";

interface ConversationListProps {
	conversations: readonly MailConversation[];
	onSelect: (conversationId: string) => void;
}

export function ConversationList({ conversations, onSelect }: ConversationListProps) {
	const { t } = useTranslation();

	if (conversations.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-3 py-20">
				<InboxIcon className="size-10 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">{t("No conversations")}</p>
			</div>
		);
	}

	return (
		<div className="flex min-w-0 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden">
			{conversations.map((conversation) => (
				<button
					key={conversation.id}
					type="button"
					className="flex flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent"
					onClick={() => onSelect(conversation.id)}
				>
					<div className="flex min-w-0 items-center justify-between gap-2">
						<span
							className={cn(
								"truncate text-sm font-medium",
								conversation.unreadCount > 0 && "font-semibold",
							)}
						>
							{conversation.subject ?? t("(No subject)")}
						</span>
						{conversation.latestMessageAt && (
							<span className="shrink-0 text-xs text-muted-foreground">
								{formatRelativeTime(conversation.latestMessageAt)}
							</span>
						)}
					</div>
					{conversation.snippet && (
						<p className="truncate text-xs text-muted-foreground">{conversation.snippet}</p>
					)}
					<div className="flex items-center gap-2">
						{conversation.unreadCount > 0 && (
							<span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
								{conversation.unreadCount}
							</span>
						)}
						<span className="text-xs text-muted-foreground">
							{t("{{count}} messages", { count: conversation.messageCount })}
						</span>
					</div>
				</button>
			))}
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
