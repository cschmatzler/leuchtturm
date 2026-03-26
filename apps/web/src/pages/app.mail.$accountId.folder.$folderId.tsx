import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";

import { useZeroQuery } from "@chevrotain/web/lib/query";
import { MessageList } from "@chevrotain/web/pages/app.mail/-components/message-list";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/app/mail/$accountId/folder/$folderId")({
	component: FolderPage,
});

function FolderPage() {
	const { accountId, folderId } = useParams({
		from: "/app/mail/$accountId/folder/$folderId",
	});
	const navigate = useNavigate();

	const [mailboxEntries] = useZeroQuery(queries.mailFolderMessages({ folderId }));

	const messages = mailboxEntries
		.map((entry) => entry.message)
		.filter((m): m is NonNullable<typeof m> => m !== null && m !== undefined);

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
