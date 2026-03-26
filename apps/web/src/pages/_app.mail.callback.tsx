import { createFileRoute, redirect } from "@tanstack/react-router";
import { Effect, Schema } from "effect";

import { MailOAuthStateId } from "@chevrotain/core/mail/schema";
import { apiClient } from "@chevrotain/web/clients/api";

const searchSchema = Schema.Struct({
	code: Schema.String,
	state: MailOAuthStateId,
});

export const Route = createFileRoute("/_app/mail/callback")({
	validateSearch: Schema.toStandardSchemaV1(searchSchema),
	beforeLoad: async ({ search }) => {
		const data = await (async () => {
			try {
				return await Effect.runPromise(
					Effect.gen(function* () {
						const api = yield* apiClient;
						return yield* api.mail.mailOAuthCallback({
							payload: { code: search.code, state: search.state },
						});
					}),
				);
			} catch {
				throw redirect({ to: "/mail" });
			}
		})();

		throw redirect({
			to: "/mac_{$accountId}",
			params: { accountId: data.accountId },
		});
	},
});
