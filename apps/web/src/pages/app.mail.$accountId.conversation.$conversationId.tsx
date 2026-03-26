import { createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";
import { Link } from "@chevrotain/web/components/ui/link";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { MessageDetail } from "@chevrotain/web/pages/app.mail/-components/message-detail";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/app/mail/$accountId/conversation/$conversationId")({
	component: ConversationPage,
});

function ConversationPage() {
	const { t } = useTranslation();
	const { accountId, conversationId } = useParams({
		from: "/app/mail/$accountId/conversation/$conversationId",
	});

	const [messages] = useZeroQuery(queries.mailConversationMessages({ conversationId }));

	const subject = messages[0]?.subject;

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link to="/app/mail/$accountId" params={{ accountId }}>
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
			<div className="flex flex-col divide-y divide-border overflow-y-auto">
				{messages.map((message) => (
					<MessageDetail key={message.id} messageId={message.id} />
				))}
			</div>
		</div>
	);
}
