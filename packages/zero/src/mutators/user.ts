import { defineMutator } from "@rocicorp/zero";
import { Schema } from "effect";

import { User } from "@chevrotain/core/auth/schema";
import { PublicError } from "@chevrotain/core/result";
import { assertLoggedIn } from "@chevrotain/zero/mutators/shared";

export const userMutators = {
	update: defineMutator(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				id: Schema.String,
				email: Schema.optional(User.fields.email),
				name: Schema.optional(User.fields.name),
				language: Schema.optional(Schema.String),
			}),
		),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			if (ctx.userId !== args.id) throw new PublicError({ status: 403 });
			await tx.mutate.user.update(args);
		},
	),
};
