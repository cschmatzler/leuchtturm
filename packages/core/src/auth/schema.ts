import { Effect, Schema, SchemaGetter } from "effect";

import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

export const Password = Schema.String.check(Schema.isMinLength(13)).annotate({
	message: "Password must be more than 12 characters",
});

export const Role = Schema.Literals(["admin", "owner", "member"]);

export const Slug = Schema.String.pipe(
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

export const User = Schema.Struct({
	id: Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId")),
	name: TrimmedNonEmptyString.annotate({ message: "Name is required" }),
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

export const Organization = Schema.Struct({
	id: Schema.TemplateLiteral(["org_", Ulid]).pipe(Schema.brand("OrganizationId")),
	name: Schema.String.pipe(
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
	slug: Slug,
	logo: Schema.optional(Schema.NullOr(Schema.String)),
	metadata: Schema.optional(Schema.NullOr(Schema.String)),
	createdAt: Schema.Date,
});

export const Team = Schema.Struct({
	id: Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId")),
	name: Schema.String.pipe(
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
	slug: Schema.String.check(Schema.isPattern(/^[a-z0-9_-]+$/)).annotate({
		message:
			"Team slug must contain only lowercase ASCII letters, numbers, dashes, and underscores",
	}),
	organizationId: Organization.fields.id,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const Member = Schema.Struct({
	id: Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId")),
	organizationId: Organization.fields.id,
	userId: User.fields.id,
	role: Role,
	createdAt: Schema.Date,
});

export const TeamMember = Schema.Struct({
	id: Schema.TemplateLiteral(["tmb_", Ulid]).pipe(Schema.brand("TeamMemberId")),
	teamId: Team.fields.id,
	userId: User.fields.id,
	createdAt: Schema.Date,
});

export const Invitation = Schema.Struct({
	id: Schema.TemplateLiteral(["inv_", Ulid]).pipe(Schema.brand("InvitationId")),
	email: Email,
	role: Schema.optional(Role),
	status: Schema.String,
	expiresAt: Schema.Date,
	organizationId: Organization.fields.id,
	teamId: Schema.optional(Schema.NullOr(Team.fields.id)),
	inviterId: User.fields.id,
	createdAt: Schema.Date,
});

export const Session = Schema.Struct({
	id: Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId")),
	token: Schema.String,
	ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
	userAgent: Schema.optional(Schema.NullOr(Schema.String)),
	expiresAt: Schema.Date,
	userId: User.fields.id,
	activeOrganizationId: Schema.optional(Schema.NullOr(Organization.fields.id)),
	activeTeamId: Schema.optional(Schema.NullOr(Team.fields.id)),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const Account = Schema.Struct({
	id: Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId")),
});

export const Verification = Schema.Struct({
	id: Schema.TemplateLiteral(["ver_", Ulid]).pipe(Schema.brand("VerificationId")),
});

export const DeviceSessions = Schema.Array(
	Schema.Struct({
		session: Session,
		user: User,
	}),
);

export const SessionData = Schema.Struct({
	user: User,
	session: Session,
});
