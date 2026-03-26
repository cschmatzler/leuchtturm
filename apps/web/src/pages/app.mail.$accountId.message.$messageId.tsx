import { createFileRoute, useParams } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@chevrotain/web/components/ui/button";
import { Link } from "@chevrotain/web/components/ui/link";
import { MessageDetail } from "@chevrotain/web/pages/app.mail/-components/message-detail";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/app/mail/$accountId/message/$messageId")({
	loader: async ({ context: { zero }, params: { messageId } }) => {
		zero.preload(queries.mailMessageBodyParts({ messageId }));
	},
	component: MessagePage,
});

function MessagePage() {
	const { accountId, messageId } = useParams({
		from: "/app/mail/$accountId/message/$messageId",
	});

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<Link to="/app/mail/$accountId" params={{ accountId }}>
					<Button variant="ghost" size="icon">
						<ArrowLeftIcon className="size-4" />
					</Button>
				</Link>
			</div>
			<MessageDetail messageId={messageId} />
		</div>
	);
}
