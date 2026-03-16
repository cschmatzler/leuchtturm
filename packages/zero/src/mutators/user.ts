import { defineMutator } from "@rocicorp/zero";
import { type } from "arktype";

import { User } from "@one/core/auth/schema";
import { PublicError } from "@one/core/result";
import { assertLoggedIn } from "@one/zero/mutators/shared";

export const userMutators = {
	update: defineMutator(
		type({
			id: "string",
			"email?": User.get("email"),
			"name?": User.get("name"),
			"language?": User.get("language").exclude("null"),
		}),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			if (ctx.userId !== args.id) throw new PublicError({ status: 403 });
			await tx.mutate.user.update(args);
		},
	),
};
