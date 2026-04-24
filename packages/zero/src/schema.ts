import {
	createBuilder,
	createSchema,
	number,
	relationships,
	string,
	table,
	type Row,
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

export const schema = createSchema({
	tables: [user, organization, member],
	relationships: [userRelationships, organizationRelationships, memberRelationships],
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

export type User = Row<typeof schema.tables.user>;
export type Organization = Row<typeof schema.tables.organization>;
export type Member = Row<typeof schema.tables.member>;

export type { Zero };
