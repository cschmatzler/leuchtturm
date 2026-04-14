import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@leuchtturm/web/components/ui/button";
import { Link } from "@leuchtturm/web/components/ui/link";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { MailAccountShell } from "@leuchtturm/web/pages/_app.mail/-components/account-shell";
import { MessageDetail } from "@leuchtturm/web/pages/_app.mail/-components/message-detail";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/_app/mmg_{$messageId}")({
	params: {
		parse: (params) => ({
			messageId: params.messageId.startsWith("mmg_") ? params.messageId : `mmg_${params.messageId}`,
		}),
		stringify: (params) => ({
			messageId: params.messageId.startsWith("mmg_")
				? params.messageId.slice("mmg_".length)
				: params.messageId,
		}),
	},
	loader: async ({ context: { zero }, params: { messageId } }) => {
		zero.preload(queries.mailMessage({ messageId }));
		zero.preload(queries.mailMessageBodyParts({ messageId }));
	},
	component: MessagePage,
});

function MessagePage() {
	const { messageId } = Route.useParams();
	const [message] = useZeroQuery(queries.mailMessage({ messageId }));

	if (!message) return null;

	return (
		<MailAccountShell accountId={message.accountId}>
			<div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
				<div className="flex items-center gap-3 border-b border-border px-4 py-3">
					<Link to="/mac_{$accountId}" params={{ accountId: message.accountId }}>
						<Button variant="ghost" size="icon">
							<ArrowLeftIcon className="size-4" />
						</Button>
					</Link>
				</div>
				<MessageDetail messageId={messageId} />
			</div>
		</MailAccountShell>
	);
}
