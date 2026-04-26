import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { OrganizationSlug } from "@leuchtturm/core/auth/schema";
import { schema, zql } from "@leuchtturm/zero/schema";
import type { Context } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<typeof schema, Context>();
const defineQueries = defineQueriesWithType<typeof schema>();
const organizationArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		slug: OrganizationSlug,
	}),
);

const organizationIdArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organizationId: Schema.String,
	}),
);

const teamArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organizationId: Schema.String,
		teamSlug: Schema.String,
	}),
);

const teamIdArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		teamId: Schema.String,
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
			.related("members", (query) => query.related("user"))
			.related("teams")
			.one(),
	),

	organizationMembers: defineQuery(organizationIdArgs, ({ args }) =>
		zql.member.where("organizationId", args.organizationId).related("user"),
	),

	organizationTeams: defineQuery(organizationIdArgs, ({ args }) =>
		zql.team.where("organizationId", args.organizationId),
	),

	team: defineQuery(teamArgs, ({ args }) =>
		zql.team.where("organizationId", args.organizationId).where("slug", args.teamSlug).one(),
	),

	teamMembers: defineQuery(teamIdArgs, ({ args }) =>
		zql.team_member.where("teamId", args.teamId).related("user"),
	),
});
