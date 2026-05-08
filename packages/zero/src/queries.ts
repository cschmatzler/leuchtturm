import { defineQueriesWithType, defineQueryWithType } from "@rocicorp/zero";
import * as Schema from "effect/Schema";

import { OrganizationSelect, TeamSelect } from "@leuchtturm/core/auth/schema";
import { assertOrganizationMember } from "@leuchtturm/zero/authorization";
import { schema, zql } from "@leuchtturm/zero/schema";
import type { Context } from "@leuchtturm/zero/schema";

const defineQuery = defineQueryWithType<typeof schema, Context>();
const defineQueries = defineQueriesWithType<typeof schema>();

export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId).one()),

	organization: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organization: OrganizationSelect.fields.slug,
			}),
		),
		({ ctx, args }) =>
			assertOrganizationMember(zql.organization.where("slug", args.organization), ctx)
				.related("members", (query) => query.related("user"))
				.related("teams")
				.one(),
	),

	organizationMembers: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: OrganizationSelect.fields.id,
			}),
		),
		({ ctx, args }) =>
			zql.member
				.where("organizationId", args.organizationId)
				.whereExists("organization", (query) => assertOrganizationMember(query, ctx))
				.related("user"),
	),

	organizationInvitations: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: OrganizationSelect.fields.id,
			}),
		),
		({ ctx, args }) =>
			zql.invitation
				.where("organizationId", args.organizationId)
				.where("status", "pending")
				.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
	),

	organizationTeams: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: OrganizationSelect.fields.id,
			}),
		),
		({ ctx, args }) =>
			zql.team
				.where("organizationId", args.organizationId)
				.whereExists("organization", (query) => assertOrganizationMember(query, ctx)),
	),

	team: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				organizationId: OrganizationSelect.fields.id,
				team: TeamSelect.fields.slug,
			}),
		),
		({ ctx, args }) =>
			zql.team
				.where("organizationId", args.organizationId)
				.where("slug", args.team)
				.whereExists("organization", (query) => assertOrganizationMember(query, ctx))
				.one(),
	),

	teamMembers: defineQuery(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				teamId: TeamSelect.fields.id,
			}),
		),
		({ ctx, args }) =>
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
				organizationId: OrganizationSelect.fields.id,
				team: TeamSelect.fields.slug,
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
