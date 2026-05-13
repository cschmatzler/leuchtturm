import { defineRelationsPart } from "drizzle-orm";
import { boolean, char, index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const userTable = pgTable("user", {
	id: char("id", { length: 30 }).primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	image: text("image"),
	language: text("language"),
	role: text("role").default("user"),
	twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
	banned: boolean("banned").default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});

export const sessionTable = pgTable(
	"session",
	{
		id: char("id", { length: 30 }).primaryKey(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		expiresAt: timestamp("expires_at").notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		activeOrganizationId: char("active_organization_id", { length: 30 }).references(
			() => organizationTable.id,
			{ onDelete: "set null" },
		),
		activeTeamId: char("active_team_id", { length: 30 }).references(() => teamTable.id, {
			onDelete: "set null",
		}),
		impersonatedBy: char("impersonated_by", { length: 30 }).references(() => userTable.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const accountTable = pgTable(
	"account",
	{
		id: char("id", { length: 30 }).primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
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

export const verificationTable = pgTable(
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

export const twoFactorTable = pgTable(
	"two_factor",
	{
		id: char("id", { length: 30 }).primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		verified: boolean("verified").default(true).notNull(),
	},
	(table) => [
		index("two_factor_user_id_idx").on(table.userId),
		unique("two_factor_user_id_uniq").on(table.userId),
	],
);

export const organizationTable = pgTable("organization", {
	id: char("id", { length: 30 }).primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	metadata: text("metadata"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberTable = pgTable(
	"member",
	{
		id: char("id", { length: 30 }).primaryKey(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		role: text("role").default("member").notNull(),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("member_organization_id_idx").on(table.organizationId),
		index("member_user_id_idx").on(table.userId),
		unique("member_user_organization_uniq").on(table.userId, table.organizationId),
	],
);

export const teamTable = pgTable(
	"team",
	{
		id: char("id", { length: 30 }).primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("team_organization_id_idx").on(table.organizationId),
		unique("team_organization_slug_uniq").on(table.organizationId, table.slug),
	],
);

export const teamMemberTable = pgTable(
	"team_member",
	{
		id: char("id", { length: 30 }).primaryKey(),
		teamId: char("team_id", { length: 30 })
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("team_member_team_id_idx").on(table.teamId),
		index("team_member_user_id_idx").on(table.userId),
		unique("team_member_user_team_uniq").on(table.userId, table.teamId),
	],
);

export const invitationTable = pgTable(
	"invitation",
	{
		id: char("id", { length: 30 }).primaryKey(),
		email: text("email").notNull(),
		role: text("role"),
		status: text("status").default("pending").notNull(),
		expiresAt: timestamp("expires_at").notNull(),
		organizationId: char("organization_id", { length: 30 })
			.notNull()
			.references(() => organizationTable.id, { onDelete: "cascade" }),
		teamId: char("team_id", { length: 30 }).references(() => teamTable.id, {
			onDelete: "set null",
		}),
		inviterId: char("inviter_id", { length: 30 })
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").notNull(),
	},
	(table) => [
		index("invitation_organization_id_idx").on(table.organizationId),
		index("invitation_email_idx").on(table.email),
	],
);

export const authRelations = defineRelationsPart(
	{
		user: userTable,
		session: sessionTable,
		account: accountTable,
		verification: verificationTable,
		twoFactor: twoFactorTable,
		organization: organizationTable,
		member: memberTable,
		team: teamTable,
		teamMember: teamMemberTable,
		invitation: invitationTable,
	},
	(r) => ({
		user: {
			sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			memberships: r.many.member({ from: r.user.id, to: r.member.userId }),
			invitationsSent: r.many.invitation({ from: r.user.id, to: r.invitation.inviterId }),
			twoFactor: r.one.twoFactor({ from: r.user.id, to: r.twoFactor.userId }),
		},
		session: {
			user: r.one.user({ from: r.session.userId, to: r.user.id }),
			activeOrganization: r.one.organization({
				from: r.session.activeOrganizationId,
				to: r.organization.id,
			}),
			activeTeam: r.one.team({ from: r.session.activeTeamId, to: r.team.id }),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},
		verification: {},
		twoFactor: {
			user: r.one.user({ from: r.twoFactor.userId, to: r.user.id }),
		},
		organization: {
			members: r.many.member({ from: r.organization.id, to: r.member.organizationId }),
			teams: r.many.team({ from: r.organization.id, to: r.team.organizationId }),
			invitations: r.many.invitation({
				from: r.organization.id,
				to: r.invitation.organizationId,
			}),
		},
		member: {
			organization: r.one.organization({ from: r.member.organizationId, to: r.organization.id }),
			user: r.one.user({ from: r.member.userId, to: r.user.id }),
		},
		team: {
			organization: r.one.organization({ from: r.team.organizationId, to: r.organization.id }),
			members: r.many.teamMember({ from: r.team.id, to: r.teamMember.teamId }),
		},
		teamMember: {
			team: r.one.team({ from: r.teamMember.teamId, to: r.team.id }),
			user: r.one.user({ from: r.teamMember.userId, to: r.user.id }),
		},
		invitation: {
			organization: r.one.organization({
				from: r.invitation.organizationId,
				to: r.organization.id,
			}),
			inviter: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
		},
	}),
);
