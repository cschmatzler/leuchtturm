import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";

import { zql } from "@leuchtturm/zero/schema";
import type { Context, Schema } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<Schema, Context>();
const defineQueries = defineQueriesWithType<Schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),
});
