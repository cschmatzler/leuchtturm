import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { Slug } from "@leuchtturm/core/auth/schema";
import { schema, zql } from "@leuchtturm/zero/schema";
import type { Context } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<typeof schema, Context>();
const defineQueries = defineQueriesWithType<typeof schema>();
const organizationArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organization: Slug,
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
		team: Schema.String,
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
			.where("slug", args.organization)
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

	organizationInvitations: defineQuery(organizationIdArgs, ({ args }) =>
		zql.invitation.where("organizationId", args.organizationId).where("status", "pending"),
	),

	organizationTeams: defineQuery(organizationIdArgs, ({ args }) =>
		zql.team.where("organizationId", args.organizationId),
	),

	team: defineQuery(teamArgs, ({ args }) =>
		zql.team.where("organizationId", args.organizationId).where("slug", args.team).one(),
	),

	teamMembers: defineQuery(teamIdArgs, ({ args }) =>
		zql.team_member.where("teamId", args.teamId).related("user"),
	),

	teamMembersByTeam: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: Schema.String,
				team: Schema.String,
			}),
		),
		({ args }) =>
			zql.team_member
				.whereExists("team", (query) =>
					query.where("organizationId", args.organizationId).where("slug", args.team),
				)
				.related("user"),
	),
});
