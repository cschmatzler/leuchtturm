import { queryOptions } from "@tanstack/react-query";

import type { ConversationRenderBundle, MessageRenderBundle } from "@leuchtturm/core/mail/render";
import { api } from "@leuchtturm/web/clients/api";

export const conversationRenderQuery = (conversationId: string) =>
	queryOptions({
		queryKey: ["mail", "conversationRender", conversationId] as const,
		queryFn: async (): Promise<ConversationRenderBundle> =>
			await api.mail.mailConversationRender({
				params: {
					conversationId: conversationId as never,
				},
			}),
	});

export const messageRenderQuery = (messageId: string) =>
	queryOptions({
		queryKey: ["mail", "messageRender", messageId] as const,
		queryFn: async (): Promise<MessageRenderBundle> =>
			await api.mail.mailMessageRender({
				params: {
					messageId: messageId as never,
				},
			}),
	});
