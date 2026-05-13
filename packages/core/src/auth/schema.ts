import { createInsertSchema, createSelectSchema } from "drizzle-orm/effect-schema";
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
	twoFactorTable,
	userTable,
	verificationTable,
} from "@leuchtturm/core/auth/auth.sql";
import { Email, Ulid } from "@leuchtturm/core/schema";

export const Role = Schema.Literals(["admin", "owner", "member"]);
const UserRole = Schema.Literals(["admin", "user"]);

export const UserInsert = createInsertSchema(userTable, {
	id: () => Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	name: () =>
		Schema.String.pipe(
			Schema.decodeTo(Schema.NonEmptyString.annotate({ message: "Name is required" }), {
				decode: SchemaGetter.transform((value: string) => value.trim()),
				encode: SchemaGetter.transform((value: string) => value),
			}),
		),
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
export const TeamSelect = createSelectSchema(teamTable);

export const MemberSelect = createSelectSchema(memberTable);

export const TeamMemberSelect = createSelectSchema(teamMemberTable);

export const InvitationSelect = createSelectSchema(invitationTable);

export const SessionSelect = createSelectSchema(sessionTable);

export const AccountSelect = createSelectSchema(accountTable);

export const VerificationSelect = createSelectSchema(verificationTable);

export const TwoFactorSelect = createSelectSchema(twoFactorTable);

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
