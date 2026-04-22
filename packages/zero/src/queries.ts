import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { OrganizationSlug } from "@leuchtturm/core/auth/schema";
import { zql } from "@leuchtturm/zero/schema";
import type { Context, Schema as ZeroSchema } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<ZeroSchema, Context>();
const defineQueries = defineQueriesWithType<ZeroSchema>();
const organizationArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		slug: OrganizationSlug,
	}),
);

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),

	organization: defineQuery(organizationArgs, ({ ctx, args }) =>
		zql.organization
			.where("slug", args.slug)
			.whereExists("members", (query) =>
				query.whereExists("user", (userQuery) => userQuery.where("id", ctx?.userId ?? "")),
			)
			.one(),
	),
});
