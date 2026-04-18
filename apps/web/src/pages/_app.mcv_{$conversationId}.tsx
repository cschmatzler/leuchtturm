import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@leuchtturm/web/components/ui/button";
import { Link } from "@leuchtturm/web/components/ui/link";
import { useReactQuery, useZeroQuery } from "@leuchtturm/web/lib/query";
import { MailAccountShell } from "@leuchtturm/web/pages/_app.mail/-components/account-shell";
import { MessageDetail } from "@leuchtturm/web/pages/_app.mail/-components/message-detail";
import { conversationRenderQuery } from "@leuchtturm/web/queries/mail-render";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/_app/mcv_{$conversationId}")({
	params: {
		parse: (params) => ({
			conversationId: params.conversationId.startsWith("mcv_")
				? params.conversationId
				: `mcv_${params.conversationId}`,
		}),
		stringify: (params) => ({
			conversationId: params.conversationId.startsWith("mcv_")
				? params.conversationId.slice("mcv_".length)
				: params.conversationId,
		}),
	},
	loader: async ({ context: { queryClient, zero }, params: { conversationId } }) => {
		zero.preload(queries.mailConversation({ conversationId }));
		zero.preload(queries.mailConversationMessages({ conversationId }));
		await queryClient.ensureQueryData(conversationRenderQuery(conversationId));
	},
	component: ConversationPage,
});

function ConversationPage() {
	const { t } = useTranslation();
	const { conversationId } = Route.useParams();
	const [conversation] = useZeroQuery(queries.mailConversation({ conversationId }));
	const [messages] = useZeroQuery(queries.mailConversationMessages({ conversationId }));
	const { data: renderBundle } = useReactQuery(conversationRenderQuery(conversationId));

	const renderByMessageId = useMemo(
		() => new Map(renderBundle?.messages.map((message) => [message.messageId, message])),
		[renderBundle],
	);

	const accountId = conversation?.accountId ?? messages[0]?.accountId;
	const subject = conversation?.subject ?? messages[0]?.subject;

	if (!accountId) return null;

	return (
		<MailAccountShell accountId={accountId}>
			<div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
				<div className="flex items-center gap-3 border-b border-border px-4 py-3">
					<Link to="/mac_{$accountId}" params={{ accountId }}>
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="size-4" />
						</Button>
					</Link>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-base font-semibold">{subject ?? t("(No subject)")}</h2>
						<p className="text-xs text-muted-foreground">
							{t("{{count}} messages", { count: messages.length })}
						</p>
					</div>
				</div>
				<div className="flex min-w-0 flex-col divide-y divide-border overflow-y-auto overflow-x-hidden">
					{messages.map((message) => {
						const render = renderByMessageId.get(message.id);
						return (
							<MessageDetail
								key={message.id}
								renderKind={render?.renderKind ?? "text"}
								content={render?.content ?? ""}
							/>
						);
					})}
				</div>
			</div>
		</MailAccountShell>
	);
}
