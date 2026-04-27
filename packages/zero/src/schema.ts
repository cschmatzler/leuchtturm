import {
	createBuilder,
	createSchema,
	number,
	relationships,
	string,
	table,
	type Zero,
} from "@rocicorp/zero";

import { SupportedLanguage } from "@leuchtturm/core/i18n";

const user = table("user")
	.columns({
		id: string(),
		name: string(),
		email: string(),
		language: string<typeof SupportedLanguage.Type>().optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const organization = table("organization")
	.columns({
		id: string(),
		name: string(),
		slug: string(),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const member = table("member")
	.columns({
		id: string(),
		organizationId: string().from("organization_id"),
		userId: string().from("user_id"),
		role: string(),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const team = table("team")
	.columns({
		id: string(),
		name: string(),
		slug: string(),
		organizationId: string().from("organization_id"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at").optional(),
	})
	.primaryKey("id");

const teamMember = table("team_member")
	.columns({
		id: string(),
		teamId: string().from("team_id"),
		userId: string().from("user_id"),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const userRelationships = relationships(user, ({ many }) => ({
	memberships: many({
		sourceField: ["id"],
		destSchema: member,
		destField: ["userId"],
	}),
}));

const organizationRelationships = relationships(organization, ({ many }) => ({
	members: many({
		sourceField: ["id"],
		destSchema: member,
		destField: ["organizationId"],
	}),
	teams: many({
		sourceField: ["id"],
		destSchema: team,
		destField: ["organizationId"],
	}),
}));

const memberRelationships = relationships(member, ({ one }) => ({
	organization: one({
		sourceField: ["organizationId"],
		destSchema: organization,
		destField: ["id"],
	}),
	user: one({
		sourceField: ["userId"],
		destSchema: user,
		destField: ["id"],
	}),
}));

const teamRelationships = relationships(team, ({ many, one }) => ({
	organization: one({
		sourceField: ["organizationId"],
		destSchema: organization,
		destField: ["id"],
	}),
	members: many({
		sourceField: ["id"],
		destSchema: teamMember,
		destField: ["teamId"],
	}),
}));

const teamMemberRelationships = relationships(teamMember, ({ one }) => ({
	team: one({
		sourceField: ["teamId"],
		destSchema: team,
		destField: ["id"],
	}),
	user: one({
		sourceField: ["userId"],
		destSchema: user,
		destField: ["id"],
	}),
}));

export const schema = createSchema({
	tables: [user, organization, member, team, teamMember],
	relationships: [
		userRelationships,
		organizationRelationships,
		memberRelationships,
		teamRelationships,
		teamMemberRelationships,
	],
});

export const zql = createBuilder(schema);

export type Schema = typeof schema;

export type Context = { userId: string };

declare module "@rocicorp/zero" {
	interface DefaultTypes {
		schema: Schema;
		context: Context;
	}
}

export type { Zero };
