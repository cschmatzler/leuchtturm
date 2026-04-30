import {
	createBuilder,
	createSchema,
	number,
	relationships,
	string,
	table,
	type Zero,
} from "@rocicorp/zero";

import {
	Invitation,
	Member,
	Organization,
	Team,
	TeamMember,
	User,
} from "@leuchtturm/core/auth/schema";
import { SupportedLanguage } from "@leuchtturm/core/i18n";

const user = table("user")
	.columns({
		id: string<typeof User.fields.id.Type>(),
		name: string(),
		email: string(),
		language: string<typeof SupportedLanguage.Type>().optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

const organization = table("organization")
	.columns({
		id: string<typeof Organization.fields.id.Type>(),
		name: string(),
		slug: string(),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const member = table("member")
	.columns({
		id: string<typeof Member.fields.id.Type>(),
		organizationId: string<typeof Organization.fields.id.Type>().from("organization_id"),
		userId: string<typeof User.fields.id.Type>().from("user_id"),
		role: string(),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const invitation = table("invitation")
	.columns({
		id: string<typeof Invitation.fields.id.Type>(),
		email: string(),
		role: string().optional(),
		status: string(),
		expiresAt: number().from("expires_at"),
		organizationId: string<typeof Organization.fields.id.Type>().from("organization_id"),
		teamId: string<typeof Team.fields.id.Type>().from("team_id").optional(),
		inviterId: string<typeof User.fields.id.Type>().from("inviter_id"),
		createdAt: number().from("created_at"),
	})
	.primaryKey("id");

const team = table("team")
	.columns({
		id: string<typeof Team.fields.id.Type>(),
		name: string(),
		slug: string(),
		organizationId: string<typeof Organization.fields.id.Type>().from("organization_id"),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at").optional(),
	})
	.primaryKey("id");

const teamMember = table("team_member")
	.columns({
		id: string<typeof TeamMember.fields.id.Type>(),
		teamId: string<typeof Team.fields.id.Type>().from("team_id"),
		userId: string<typeof User.fields.id.Type>().from("user_id"),
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
	invitations: many({
		sourceField: ["id"],
		destSchema: invitation,
		destField: ["organizationId"],
	}),
	teams: many({
		sourceField: ["id"],
		destSchema: team,
		destField: ["organizationId"],
	}),
}));

const invitationRelationships = relationships(invitation, ({ one }) => ({
	organization: one({
		sourceField: ["organizationId"],
		destSchema: organization,
		destField: ["id"],
	}),
	inviter: one({
		sourceField: ["inviterId"],
		destSchema: user,
		destField: ["id"],
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
	tables: [user, organization, member, invitation, team, teamMember],
	relationships: [
		userRelationships,
		organizationRelationships,
		memberRelationships,
		invitationRelationships,
		teamRelationships,
		teamMemberRelationships,
	],
});

export const zql = createBuilder(schema);

export type Schema = typeof schema;

export type Context = { userId: typeof User.fields.id.Type };

declare module "@rocicorp/zero" {
	interface DefaultTypes {
		schema: Schema;
		context: Context;
	}
}

export type { Zero };
