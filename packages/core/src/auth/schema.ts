import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/effect-schema";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

import {
	accountTable,
	invitationTable,
	memberTable,
	organizationTable,
	sessionTable,
	teamMemberTable,
	teamTable,
	userTable,
	verificationTable,
} from "@leuchtturm/core/auth/auth.sql";
import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

export const Role = Schema.Literals(["admin", "owner", "member"]);
export const UserRole = Schema.Literals(["admin", "user"]);

export const UserInsert = createInsertSchema(userTable, {
	id: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	name: () => TrimmedNonEmptyString.annotate({ message: "Name is required" }),
	email: () => Email,
	role: () => UserRole,
});
export const UserUpdate = createUpdateSchema(userTable, {
	id: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	name: () => TrimmedNonEmptyString.annotate({ message: "Name is required" }),
	email: () => Email,
	role: () => UserRole,
});
export const UserSelect = createSelectSchema(userTable);

export const OrganizationInsert = createInsertSchema(organizationTable, {
	id: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	name: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[A-Za-z0-9-]+$/))
					.annotate({
						message: "Organization name must contain only ASCII letters, numbers, and dashes",
					})
					.check(Schema.isMinLength(4))
					.annotate({ message: "Organization name must be more than 3 characters" }),
				{
					decode: SchemaGetter.transform((value: string) => value.trim()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
	slug: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
					.annotate({
						message: "Slug must contain only lowercase letters, numbers, and dashes",
					})
					.check(Schema.isMinLength(4))
					.annotate({ message: "Slug must be more than 3 characters" }),
				{
					decode: SchemaGetter.transform((value: string) => value.trim().toLowerCase()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
});
export const OrganizationUpdate = createUpdateSchema(organizationTable, {
	id: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	name: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[A-Za-z0-9-]+$/))
					.annotate({
						message: "Organization name must contain only ASCII letters, numbers, and dashes",
					})
					.check(Schema.isMinLength(4))
					.annotate({ message: "Organization name must be more than 3 characters" }),
				{
					decode: SchemaGetter.transform((value: string) => value.trim()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
	slug: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
					.annotate({
						message: "Slug must contain only lowercase letters, numbers, and dashes",
					})
					.check(Schema.isMinLength(4))
					.annotate({ message: "Slug must be more than 3 characters" }),
				{
					decode: SchemaGetter.transform((value: string) => value.trim().toLowerCase()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
});
export const OrganizationSelect = createSelectSchema(organizationTable);

export const TeamInsert = createInsertSchema(teamTable, {
	id: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	name: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/)).annotate({
					message: "Team name must contain only ASCII letters, numbers, dashes, and underscores",
				}),
				{
					decode: SchemaGetter.transform((value: string) => value.trim()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
	slug: () =>
		Schema.String.check(Schema.isPattern(/^[a-z0-9_-]+$/)).annotate({
			message:
				"Team slug must contain only lowercase ASCII letters, numbers, dashes, and underscores",
		}),
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
});
export const TeamUpdate = createUpdateSchema(teamTable, {
	id: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	name: () =>
		Schema.String.pipe(
			Schema.decodeTo(
				Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/)).annotate({
					message: "Team name must contain only ASCII letters, numbers, dashes, and underscores",
				}),
				{
					decode: SchemaGetter.transform((value: string) => value.trim()),
					encode: SchemaGetter.transform((value: string) => value),
				},
			),
		),
	slug: () =>
		Schema.String.check(Schema.isPattern(/^[a-z0-9_-]+$/)).annotate({
			message:
				"Team slug must contain only lowercase ASCII letters, numbers, dashes, and underscores",
		}),
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
});
export const TeamSelect = createSelectSchema(teamTable);

export const MemberInsert = createInsertSchema(memberTable, {
	id: () => Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId")),
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	role: () => Role,
});
export const MemberUpdate = createUpdateSchema(memberTable, {
	id: () => Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId")),
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	role: () => Role,
});
export const MemberSelect = createSelectSchema(memberTable);

export const TeamMemberInsert = createInsertSchema(teamMemberTable, {
	id: () => Schema.TemplateLiteral(["tmb_", Ulid]).pipe(Schema.brand("TeamMemberId")),
	teamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const TeamMemberUpdate = createUpdateSchema(teamMemberTable, {
	id: () => Schema.TemplateLiteral(["tmb_", Ulid]).pipe(Schema.brand("TeamMemberId")),
	teamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const TeamMemberSelect = createSelectSchema(teamMemberTable);

export const InvitationInsert = createInsertSchema(invitationTable, {
	id: () => Schema.TemplateLiteral(["inv_", Ulid]).pipe(Schema.brand("InvitationId")),
	email: () => Email,
	role: () => Role,
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	teamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	inviterId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const InvitationUpdate = createUpdateSchema(invitationTable, {
	id: () => Schema.TemplateLiteral(["inv_", Ulid]).pipe(Schema.brand("InvitationId")),
	email: () => Email,
	role: () => Role,
	organizationId: () => Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	teamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	inviterId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const InvitationSelect = createSelectSchema(invitationTable);

export const SessionInsert = createInsertSchema(sessionTable, {
	id: () => Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	activeOrganizationId: () =>
		Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	activeTeamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	impersonatedBy: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const SessionUpdate = createUpdateSchema(sessionTable, {
	id: () => Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	activeOrganizationId: () =>
		Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	activeTeamId: () => Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	impersonatedBy: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const SessionSelect = createSelectSchema(sessionTable);

export const AccountInsert = createInsertSchema(accountTable, {
	id: () => Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const AccountUpdate = createUpdateSchema(accountTable, {
	id: () => Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId")),
	userId: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
});
export const AccountSelect = createSelectSchema(accountTable);

export const VerificationInsert = createInsertSchema(verificationTable, {
	id: () => Schema.TemplateLiteral(["ver_", Ulid]).pipe(Schema.brand("VerificationId")),
});
export const VerificationUpdate = createUpdateSchema(verificationTable, {
	id: () => Schema.TemplateLiteral(["ver_", Ulid]).pipe(Schema.brand("VerificationId")),
});
export const VerificationSelect = createSelectSchema(verificationTable);

export const DeviceSessions = Schema.Array(
	Schema.Struct({
		session: SessionSelect,
		user: UserSelect,
	}),
);

export const SessionData = Schema.Struct({
	user: UserSelect,
	session: SessionSelect,
});
