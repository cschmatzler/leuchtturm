import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { MailAccountShell } from "@leuchtturm/web/pages/_app.mail/-components/account-shell";
import { MessageList } from "@leuchtturm/web/pages/_app.mail/-components/message-list";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/_app/mfl_{$folderId}")({
	params: {
		parse: (params) => ({
			folderId: params.folderId.startsWith("mfl_") ? params.folderId : `mfl_${params.folderId}`,
		}),
		stringify: (params) => ({
			folderId: params.folderId.startsWith("mfl_")
				? params.folderId.slice("mfl_".length)
				: params.folderId,
		}),
	},
	loader: async ({ context: { zero }, params: { folderId } }) => {
		zero.preload(queries.mailFolder({ folderId }));
		zero.preload(queries.mailFolderMessages({ folderId }));
	},
	component: FolderPage,
});

function FolderPage() {
	const navigate = useNavigate();
	const { folderId } = Route.useParams();
	const [folder] = useZeroQuery(queries.mailFolder({ folderId }));
	const [mailboxEntries] = useZeroQuery(queries.mailFolderMessages({ folderId }));

	if (!folder) return null;

	const messages = mailboxEntries
		.map((entry) => entry.message)
		.filter(
			(message): message is NonNullable<typeof message> =>
				message !== null && message !== undefined,
		);

	return (
		<MailAccountShell accountId={folder.accountId}>
			<MessageList
				messages={messages}
				onSelect={(messageId) =>
					navigate({
						to: "/mmg_{$messageId}",
						params: { messageId },
					})
				}
			/>
		</MailAccountShell>
	);
}
