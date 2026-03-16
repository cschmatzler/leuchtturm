import { defineMutator } from "@rocicorp/zero";
import { type } from "arktype";

import { User } from "@roasted/core/auth/schema";
import { PublicError } from "@roasted/core/result";
import { assertLoggedIn } from "@roasted/zero/mutators/shared";

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
