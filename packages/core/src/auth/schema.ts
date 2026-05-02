import {
	createInsertSchema,
	createSelectSchema,
	createUpdateSchema,
} from "drizzle-orm/effect-schema";
import { Schema, SchemaGetter } from "effect";

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

export const Password = Schema.String.check(Schema.isMinLength(13)).annotate({
	message: "Password must be more than 12 characters",
});

export const Role = Schema.Literals(["admin", "owner", "member"]);

const UserId = Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId"));
const OrganizationId = Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId"));
const TeamId = Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId"));
const MemberId = Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId"));
const TeamMemberId = Schema.TemplateLiteral(["tmb_", Ulid]).pipe(Schema.brand("TeamMemberId"));
const InvitationId = Schema.TemplateLiteral(["inv_", Ulid]).pipe(Schema.brand("InvitationId"));
const SessionId = Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId"));
const AccountId = Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId"));
const VerificationId = Schema.TemplateLiteral(["ver_", Ulid]).pipe(Schema.brand("VerificationId"));

const Slug = Schema.String.pipe(
	Schema.decodeTo(
		Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
			.annotate({ message: "Slug must contain only lowercase letters, numbers, and dashes" })
			.check(Schema.isMinLength(4))
			.annotate({ message: "Slug must be more than 3 characters" }),
		{
			decode: SchemaGetter.transform((value: string) => value.trim().toLowerCase()),
			encode: SchemaGetter.transform((value: string) => value),
		},
	),
);

const OrganizationName = Schema.String.pipe(
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
);

const TeamName = Schema.String.pipe(
	Schema.decodeTo(
		Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]+$/)).annotate({
			message: "Team name must contain only ASCII letters, numbers, dashes, and underscores",
		}),
		{
			decode: SchemaGetter.transform((value: string) => value.trim()),
			encode: SchemaGetter.transform((value: string) => value),
		},
	),
);

const TeamSlug = Schema.String.check(Schema.isPattern(/^[a-z0-9_-]+$/)).annotate({
	message: "Team slug must contain only lowercase ASCII letters, numbers, dashes, and underscores",
});

const userRefinements = {
	id: () => UserId,
	name: () => TrimmedNonEmptyString.annotate({ message: "Name is required" }),
	email: () => Email,
};

export const UserInsert = createInsertSchema(userTable, userRefinements);
export const UserUpdate = createUpdateSchema(userTable, userRefinements);
export const UserSelect = createSelectSchema(userTable, userRefinements);

const organizationRefinements = {
	id: () => OrganizationId,
	name: () => OrganizationName,
	slug: () => Slug,
};

export const OrganizationInsert = createInsertSchema(organizationTable, organizationRefinements);
export const OrganizationUpdate = createUpdateSchema(organizationTable, organizationRefinements);
export const OrganizationSelect = createSelectSchema(organizationTable, organizationRefinements);

const teamRefinements = {
	id: () => TeamId,
	name: () => TeamName,
	slug: () => TeamSlug,
	organizationId: () => OrganizationId,
};

export const TeamInsert = createInsertSchema(teamTable, teamRefinements);
export const TeamUpdate = createUpdateSchema(teamTable, teamRefinements);
export const TeamSelect = createSelectSchema(teamTable, teamRefinements);

const memberRefinements = {
	id: () => MemberId,
	organizationId: () => OrganizationId,
	userId: () => UserId,
	role: () => Role,
};

export const MemberInsert = createInsertSchema(memberTable, memberRefinements);
export const MemberUpdate = createUpdateSchema(memberTable, memberRefinements);
export const MemberSelect = createSelectSchema(memberTable, memberRefinements);

const teamMemberRefinements = {
	id: () => TeamMemberId,
	teamId: () => TeamId,
	userId: () => UserId,
};

export const TeamMemberInsert = createInsertSchema(teamMemberTable, teamMemberRefinements);
export const TeamMemberUpdate = createUpdateSchema(teamMemberTable, teamMemberRefinements);
export const TeamMemberSelect = createSelectSchema(teamMemberTable, teamMemberRefinements);

const invitationRefinements = {
	id: () => InvitationId,
	email: () => Email,
	role: () => Role,
	organizationId: () => OrganizationId,
	teamId: () => TeamId,
	inviterId: () => UserId,
};

export const InvitationInsert = createInsertSchema(invitationTable, invitationRefinements);
export const InvitationUpdate = createUpdateSchema(invitationTable, invitationRefinements);
export const InvitationSelect = createSelectSchema(invitationTable, invitationRefinements);

const sessionRefinements = {
	id: () => SessionId,
	userId: () => UserId,
	activeOrganizationId: () => OrganizationId,
	activeTeamId: () => TeamId,
};

export const SessionInsert = createInsertSchema(sessionTable, sessionRefinements);
export const SessionUpdate = createUpdateSchema(sessionTable, sessionRefinements);
export const SessionSelect = createSelectSchema(sessionTable, sessionRefinements);

const accountRefinements = {
	id: () => AccountId,
	userId: () => UserId,
};

export const AccountInsert = createInsertSchema(accountTable, accountRefinements);
export const AccountUpdate = createUpdateSchema(accountTable, accountRefinements);
export const AccountSelect = createSelectSchema(accountTable, accountRefinements);

const verificationRefinements = {
	id: () => VerificationId,
};

export const VerificationInsert = createInsertSchema(verificationTable, verificationRefinements);
export const VerificationUpdate = createUpdateSchema(verificationTable, verificationRefinements);
export const VerificationSelect = createSelectSchema(verificationTable, verificationRefinements);

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
