import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { useZeroQuery } from "@chevrotain/web/lib/query";
import { ConversationList } from "@chevrotain/web/pages/app.mail/-components/conversation-list";
import { MessageList } from "@chevrotain/web/pages/app.mail/-components/message-list";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/app/mail/$accountId/")({
	loader: async ({ context: { zero }, params: { accountId } }) => {
		zero.preload(queries.mailAccounts());
		zero.preload(queries.mailConversations({ accountId }));
		zero.preload(queries.mailMessages({ accountId }));
	},
	component: AccountInboxPage,
});

function AccountInboxPage() {
	const { accountId } = useParams({ from: "/app/mail/$accountId/" });
	const [accounts] = useZeroQuery(queries.mailAccounts());
	const account = accounts.find((a) => a.id === accountId);

	if (!account) return null;

	if (account.supportsThreads) {
		return <ThreadedInbox accountId={accountId} />;
	}

	return <FlatInbox accountId={accountId} />;
}

function ThreadedInbox({ accountId }: { accountId: string }) {
	const navigate = useNavigate();
	const [conversations] = useZeroQuery(queries.mailConversations({ accountId }));

	return (
		<ConversationList
			conversations={conversations}
			onSelect={(conversationId) =>
				navigate({
					to: "/app/mail/$accountId/conversation/$conversationId",
					params: { accountId, conversationId },
				})
			}
		/>
	);
}

function FlatInbox({ accountId }: { accountId: string }) {
	const navigate = useNavigate();
	const [messages] = useZeroQuery(queries.mailMessages({ accountId }));

	return (
		<MessageList
			messages={messages}
			onSelect={(messageId) =>
				navigate({
					to: "/app/mail/$accountId/message/$messageId",
					params: { accountId, messageId },
				})
			}
		/>
	);
}
