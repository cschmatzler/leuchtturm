import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";

import { zql } from "@one/zero/schema";
import type { Context, Schema } from "@one/zero/schema";

const defineQuery = defineQueryWithType<Schema, Context>();
const defineQueries = defineQueriesWithType<Schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),
});
