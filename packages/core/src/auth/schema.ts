import { Effect, Schema, SchemaGetter } from "effect";

import { Email, TrimmedNonEmptyString, Ulid } from "@leuchtturm/core/schema";

export const Password = Schema.String.check(Schema.isMinLength(13)).annotate({
	message: "Password must be more than 12 characters",
});

export const UserId = Schema.TemplateLiteral(["usr_", Ulid]).pipe(Schema.brand("UserId"));

export const OrganizationId = Schema.TemplateLiteral(["org_", Ulid]).pipe(
	Schema.brand("OrganizationId"),
);

export const MemberId = Schema.TemplateLiteral(["mem_", Ulid]).pipe(Schema.brand("MemberId"));

export const Role = Schema.Literals(["admin", "owner", "member"]);

export const TeamId = Schema.TemplateLiteral(["tea_", Ulid]).pipe(Schema.brand("TeamId"));

export const Team = Schema.Struct({
	id: TeamId,
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
	organizationId: OrganizationId,
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const TeamMemberId = Schema.TemplateLiteral(["tmb_", Ulid]).pipe(
	Schema.brand("TeamMemberId"),
);

export const InvitationId = Schema.TemplateLiteral(["inv_", Ulid]).pipe(
	Schema.brand("InvitationId"),
);

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
	id: UserId,
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

export const SessionId = Schema.TemplateLiteral(["ses_", Ulid]).pipe(Schema.brand("SessionId"));

export const Session = Schema.Struct({
	id: SessionId,
	token: Schema.String,
	ipAddress: Schema.optional(Schema.NullOr(Schema.String)),
	userAgent: Schema.optional(Schema.NullOr(Schema.String)),
	expiresAt: Schema.Date,
	userId: UserId,
	activeOrganizationId: Schema.optional(Schema.NullOr(OrganizationId)),
	activeTeamId: Schema.optional(Schema.NullOr(TeamId)),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});

export const AccountId = Schema.TemplateLiteral(["acc_", Ulid]).pipe(Schema.brand("AccountId"));

export const VerificationId = Schema.TemplateLiteral(["ver_", Ulid]).pipe(
	Schema.brand("VerificationId"),
);

export const Organization = Schema.Struct({
	id: OrganizationId,
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
