import { defineRelationsPart } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { account, session, user } from "@chevrotain/core/auth/auth.sql";
import { databaseUrl } from "@chevrotain/core/config";

const pool = new Pool({
	connectionString: databaseUrl,
});

const authRelations = defineRelationsPart({ user, session, account }, (r) => ({
	user: {
		sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
		accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
	},
	session: {
		user: r.one.user({ from: r.session.userId, to: r.user.id }),
	},
	account: {
		user: r.one.user({ from: r.account.userId, to: r.user.id }),
	},
}));

export const db = drizzle({
	client: pool,
	relations: {
		...authRelations,
	},
});
