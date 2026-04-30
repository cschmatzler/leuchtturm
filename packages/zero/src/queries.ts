import { defineQueriesWithType, defineQueryWithType, type Query } from "@rocicorp/zero";
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

const assertOrganizationMember = <TReturn>(
	query: Query<"organization", typeof schema, TReturn>,
	ctx: Context | undefined,
) => query.whereExists("members", (memberQuery) => memberQuery.where("userId", ctx?.userId ?? ""));

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),

	organization: defineQuery(organizationArgs, ({ ctx, args }) =>
		assertOrganizationMember(zql.organization.where("slug", args.organization), ctx)
			.related("members", (query) => query.related("user"))
			.related("teams")
			.one(),
	),

	organizationMembers: defineQuery(organizationIdArgs, ({ ctx, args }) =>
		zql.member
			.where("organizationId", args.organizationId)
			.whereExists("organization", (query) => assertOrganizationMember(query, ctx))
			.related("user"),
	),

	organizationInvitations: defineQuery(organizationIdArgs, ({ ctx, args }) =>
		zql.invitation
			.where("organizationId", args.organizationId)
			.where("status", "pending")
			.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
	),

	organizationTeams: defineQuery(organizationIdArgs, ({ ctx, args }) =>
		zql.team
			.where("organizationId", args.organizationId)
			.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
	),

	team: defineQuery(teamArgs, ({ ctx, args }) =>
		zql.team
			.where("organizationId", args.organizationId)
			.where("slug", args.team)
			.whereExists("organization", (query) => assertOrganizationMember(query, ctx))
			.one(),
	),

	teamMembers: defineQuery(teamIdArgs, ({ ctx, args }) =>
		zql.team_member
			.where("teamId", args.teamId)
			.whereExists("team", (teamQuery) =>
				teamQuery.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
			)
			.related("user"),
	),

	teamMembersByTeam: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: Schema.String,
				team: Schema.String,
			}),
		),
		({ ctx, args }) =>
			zql.team_member
				.whereExists("team", (teamQuery) =>
					teamQuery
						.where("organizationId", args.organizationId)
						.where("slug", args.team)
						.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
				)
				.related("user"),
	),
});
