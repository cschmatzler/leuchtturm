import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { MailOAuthStateId } from "@leuchtturm/core/mail/schema";
import { api } from "@leuchtturm/web/clients/api";

const searchSchema = Schema.Struct({
	code: Schema.String,
	state: MailOAuthStateId,
});

export const Route = createFileRoute("/_app/mail/callback")({
	validateSearch: Schema.toStandardSchemaV1(searchSchema),
	beforeLoad: async ({ search }) => {
		const response = await (async () => {
			try {
				return await api.mail.mailOAuthCallback({
					payload: { code: search.code, state: search.state },
				});
			} catch {
				throw redirect({ to: "/mail" });
			}
		})();
		const data = Array.isArray(response) ? response[0] : response;

		throw redirect({
			to: "/mac_{$accountId}",
			params: { accountId: data.accountId },
		});
	},
});
