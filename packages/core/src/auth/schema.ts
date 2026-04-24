import { Effect, Schema, SchemaGetter } from "effect";

import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

export const Password = Schema.String.check(Schema.isMinLength(13)).annotate({
	description: "Password must be more than 12 characters",
});

export const UserId = Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId"));

export const OrganizationId = Schema.TemplateLiteral(["org_", Ulid]).pipe(
	Schema.brand("OrganizationId"),
);

export const MemberId = Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId"));

export const InvitationId = Schema.TemplateLiteral(["inv_", Ulid]).pipe(
	Schema.brand("InvitationId"),
);

export const OrganizationSlug = Schema.String.pipe(
	Schema.decodeTo(
		Schema.String.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).annotate({
			description: "Slug must contain only lowercase letters, numbers, and dashes",
		}),
		{
			decode: SchemaGetter.transform((value: string) => value.trim().toLowerCase()),
			encode: SchemaGetter.transform((value: string) => value),
		},
	),
);

export const User = Schema.Struct({
	id: UserId,
	name: TrimmedNonEmptyString.annotate({ description: "Name is required" }),
	email: Email,
	image: Schema.optional(Schema.NullOr(Schema.String)),
	language: Schema.optional(Schema.NullOr(Schema.String)),
	emailVerified: Schema.Boolean.pipe(
		Schema.optional,
		Schema.withDecodingDefault(Effect.succeed(false)),
	),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const SessionId = Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId"));

export const Session = Schema.Struct({
	id: SessionId,
	token: Schema.String,
	ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
	userAgent: Schema.optional(Schema.NullOr(Schema.String)),
	expiresAt: Schema.Date,
	userId: UserId,
	activeOrganizationId: Schema.optional(Schema.NullOr(OrganizationId)),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const AccountId = Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId"));

export const Account = Schema.Struct({
	id: AccountId,
	accountId: Schema.String,
	providerId: Schema.String,
	userId: UserId,
	accessToken: Schema.optional(Schema.NullOr(Schema.String)),
	refreshToken: Schema.optional(Schema.NullOr(Schema.String)),
	idToken: Schema.optional(Schema.NullOr(Schema.String)),
	accessTokenExpiresAt: Schema.optional(Schema.NullOr(Schema.Date)),
	refreshTokenExpiresAt: Schema.optional(Schema.NullOr(Schema.Date)),
	scope: Schema.optional(Schema.NullOr(Schema.String)),
	password: Schema.optional(Schema.NullOr(Password)),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const VerificationId = Schema.TemplateLiteral(["ver_", Ulid]).pipe(
	Schema.brand("VerificationId"),
);

export const Verification = Schema.Struct({
	id: VerificationId,
	identifier: Schema.String,
	value: Schema.String,
	expiresAt: Schema.Date,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const Organization = Schema.Struct({
	id: OrganizationId,
	name: TrimmedNonEmptyString.annotate({ description: "Organization name is required" }),
	slug: OrganizationSlug,
	logo: Schema.optional(Schema.NullOr(Schema.String)),
	metadata: Schema.optional(Schema.NullOr(Schema.String)),
	createdAt: Schema.Date,
});

export const Role = Schema.Literals(["owner", "admin", "member"]);

export const Member = Schema.Struct({
	id: MemberId,
	organizationId: OrganizationId,
	userId: UserId,
	role: Role,
	createdAt: Schema.Date,
});

export const InvitationStatus = Schema.Literals(["pending", "accepted", "rejected"]);

export const Invitation = Schema.Struct({
	id: InvitationId,
	email: Email,
	role: Schema.optional(Schema.NullOr(Role)),
	status: InvitationStatus,
	expiresAt: Schema.Date,
	organizationId: OrganizationId,
	inviterId: UserId,
	createdAt: Schema.Date,
});

export const OrganizationSummary = Schema.Struct({
	id: OrganizationId,
	name: TrimmedNonEmptyString,
	slug: OrganizationSlug,
});

export const DeviceSession = Schema.Struct({
	session: Session,
	user: User,
	organizations: Schema.Array(OrganizationSummary),
});

export const DeviceSessionsResponse = Schema.Struct({
	sessions: Schema.Array(DeviceSession),
	organizations: Schema.Array(
		Schema.Struct({
			...OrganizationSummary.fields,
			token: Schema.String,
		}),
	),
});

export const SessionData = Schema.Struct({
	user: User,
	session: Session,
});
