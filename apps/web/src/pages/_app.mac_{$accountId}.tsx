import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useZeroQuery } from "@chevrotain/web/lib/query";
import { parsePrefixedId, stringifyPrefixedId } from "@chevrotain/web/lib/route-params";
import { MailAccountShell } from "@chevrotain/web/pages/_app.mail/-components/account-shell";
import { ConversationList } from "@chevrotain/web/pages/_app.mail/-components/conversation-list";
import { MessageList } from "@chevrotain/web/pages/_app.mail/-components/message-list";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/_app/mac_{$accountId}")({
	params: {
		parse: (params) => ({ accountId: parsePrefixedId(params.accountId, "mac_") }),
		stringify: (params) => ({ accountId: stringifyPrefixedId(params.accountId, "mac_") }),
	},
	loader: async ({ context: { zero }, params: { accountId } }) => {
		zero.preload(queries.mailAccounts());
		zero.preload(queries.mailFolders({ accountId }));
		zero.preload(queries.mailLabels({ accountId }));
		zero.preload(queries.mailConversations({ accountId }));
		zero.preload(queries.mailMessages({ accountId }));
	},
	component: AccountInboxPage,
});

function AccountInboxPage() {
	const { accountId } = Route.useParams();
	const [accounts] = useZeroQuery(queries.mailAccounts());
	const account = accounts.find((candidate) => candidate.id === accountId);

	if (!account) return null;

	return (
		<MailAccountShell accountId={accountId}>
			<div className="min-w-0 flex flex-1 flex-col overflow-x-hidden">
				{account.supportsThreads ? (
					<ThreadedInbox accountId={accountId} />
				) : (
					<FlatInbox accountId={accountId} />
				)}
			</div>
		</MailAccountShell>
	);
}

function ThreadedInbox({ accountId }: { accountId: string }) {
	const navigate = useNavigate();
	const [conversations] = useZeroQuery(queries.mailConversations({ accountId }));

	return (
		<ConversationList
			conversations={conversations}
			onSelect={(conversationId) =>
				navigate({
					to: "/mcv_{$conversationId}",
					params: { conversationId },
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
					to: "/mmg_{$messageId}",
					params: { messageId },
				})
			}
		/>
	);
}
