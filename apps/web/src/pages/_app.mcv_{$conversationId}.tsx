import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";
import { Link } from "@chevrotain/web/components/ui/link";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { parsePrefixedId, stringifyPrefixedId } from "@chevrotain/web/lib/route-params";
import { MailAccountShell } from "@chevrotain/web/pages/_app.mail/-components/account-shell";
import { MessageDetail } from "@chevrotain/web/pages/_app.mail/-components/message-detail";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/_app/mcv_{$conversationId}")({
	params: {
		parse: (params) => ({
			conversationId: parsePrefixedId(params.conversationId, "mcv_"),
		}),
		stringify: (params) => ({
			conversationId: stringifyPrefixedId(params.conversationId, "mcv_"),
		}),
	},
	loader: async ({ context: { zero }, params: { conversationId } }) => {
		zero.preload(queries.mailConversation({ conversationId }));
		zero.preload(queries.mailConversationMessages({ conversationId }));
	},
	component: ConversationPage,
});

function ConversationPage() {
	const { t } = useTranslation();
	const { conversationId } = Route.useParams();
	const [conversation] = useZeroQuery(queries.mailConversation({ conversationId }));
	const [messages] = useZeroQuery(queries.mailConversationMessages({ conversationId }));

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
					{messages.map((message) => (
						<MessageDetail key={message.id} messageId={message.id} />
					))}
				</div>
			</div>
		</MailAccountShell>
	);
}
