import { createFileRoute, redirect } from "@tanstack/react-router";
import { Schema } from "effect";

import { MailOAuthStateId } from "@chevrotain/core/mail/schema";

const searchSchema = Schema.Struct({
	code: Schema.String,
	state: MailOAuthStateId,
});

export const Route = createFileRoute("/app/mail/callback")({
	validateSearch: Schema.toStandardSchemaV1(searchSchema),
	beforeLoad: async ({ search }) => {
		const res = await fetch(`${import.meta.env.VITE_API_URL}/api/mail/oauth/callback`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: search.code, state: search.state }),
			credentials: "include",
		});

		if (!res.ok) {
			throw redirect({ to: "/app/mail" });
		}

		const data = (await res.json()) as { accountId: string };
		throw redirect({
			to: "/app/mail/$accountId",
			params: { accountId: data.accountId },
		});
	},
});
