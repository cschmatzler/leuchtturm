import type { Query } from "@rocicorp/zero";

import { schema, type Context } from "@leuchtturm/zero/schema";

export const assertOrganizationMember = <TReturn>(
	query: Query<"organization", typeof schema, TReturn>,
	ctx: Context | undefined,
) => query.whereExists("members", (memberQuery) => memberQuery.where("userId", ctx?.userId ?? ""));
