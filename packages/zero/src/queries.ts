import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";

import { zql } from "@chevrotain/zero/schema";
import type { Context, Schema } from "@chevrotain/zero/schema";

const defineQuery = defineQueryWithType<Schema, Context>();
const defineQueries = defineQueriesWithType<Schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),
});
