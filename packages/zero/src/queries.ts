import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import { Schema } from "effect";

import { Organization, Team } from "@leuchtturm/core/auth/schema";
import { assertOrganizationMember } from "@leuchtturm/zero/authorization";
import { schema, zql } from "@leuchtturm/zero/schema";
import type { Context } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<typeof schema, Context>();
const defineQueries = defineQueriesWithType<typeof schema>();
const organizationArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organization: Organization.fields.slug,
	}),
);

const organizationIdArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organizationId: Organization.fields.id,
	}),
);

const teamArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		organizationId: Organization.fields.id,
		team: Team.fields.slug,
	}),
);

const teamIdArgs = Schema.toStandardSchemaV1(
	Schema.Struct({
		teamId: Team.fields.id,
	}),
);

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId).one()),

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
				organizationId: Organization.fields.id,
				team: Team.fields.slug,
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
