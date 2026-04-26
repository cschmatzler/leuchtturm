import { boolean, char, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: char("id", { length: 30 }).primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	image: text("image"),
	language: text("language"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: char("id", { length: 30 }).primaryKey(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		expiresAt: timestamp("expires_at").notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		activeOrganizationId: char("active_organization_id", { length: 30 }).references(
			() => organization.id,
			{ onDelete: "set null" },
		),
		activeTeamId: char("active_team_id", { length: 30 }).references(() => team.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("account_user_id_idx").on(table.userId),
		unique("account_provider_account_id_uniq").on(table.providerId, table.accountId),
	],
);

export const verification = pgTable(
	"verification",
	{
		id: char("id", { length: 30 }).primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("verification_identifier_idx").on(table.identifier),
		unique("verification_identifier_value_uniq").on(table.identifier, table.value),
	],
);

export const organization = pgTable("organization", {
	id: char("id", { length: 30 }).primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	metadata: text("metadata"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const member = pgTable(
	"member",
	{
		id: char("id", { length: 30 }).primaryKey(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").default("member").notNull(),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("member_organization_id_idx").on(table.organizationId),
		index("member_user_id_idx").on(table.userId),
		unique("member_user_organization_uniq").on(table.userId, table.organizationId),
	],
);

export const team = pgTable(
	"team",
	{
		id: char("id", { length: 30 }).primaryKey(),
		name: text("name").notNull(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("team_organization_id_idx").on(table.organizationId)],
);

export const teamMember = pgTable(
	"team_member",
	{
		id: char("id", { length: 30 }).primaryKey(),
		teamId: char("team_id", { length: 30 })
			.notNull()
			.references(() => team.id, { onDelete: "cascade" }),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("team_member_team_id_idx").on(table.teamId),
		index("team_member_user_id_idx").on(table.userId),
		unique("team_member_user_team_uniq").on(table.userId, table.teamId),
	],
);

export const invitation = pgTable(
	"invitation",
	{
		id: char("id", { length: 30 }).primaryKey(),
		email: text("email").notNull(),
		role: text("role"),
		status: text("status").default("pending").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		teamId: char("team_id", { length: 30 }).references(() => team.id, { onDelete: "set null" }),
		inviterId: char("inviter_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("invitation_organization_id_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
	],
);
