import { defineMutator } from "@rocicorp/zero";
import { Schema } from "effect";

import { User } from "@leuchtturm/core/auth/schema";
import { ForbiddenError } from "@leuchtturm/core/errors";
import { SupportedLanguage } from "@leuchtturm/core/i18n";
import { assertLoggedIn } from "@leuchtturm/zero/mutators/shared";

export const userMutators = {
	update: defineMutator(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				id: Schema.String,
				name: Schema.optional(User.fields.name),
				language: Schema.optional(SupportedLanguage),
			}),
		),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			if (ctx.userId !== args.id)
				throw new ForbiddenError({ message: "Cannot update another user" });
			await tx.mutate.user.update(args);
		},
	),
};
