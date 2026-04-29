import { Schema } from "effect";

export class AuthHandlerError extends Schema.TaggedErrorClass<AuthHandlerError>()(
	"AuthHandlerError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Auth handler failed" });
	}
}

export class AuthSessionLookupError extends Schema.TaggedErrorClass<AuthSessionLookupError>()(
	"AuthSessionLookupError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Auth session lookup failed" });
	}
}

export class AuthDeviceSessionsListError extends Schema.TaggedErrorClass<AuthDeviceSessionsListError>()(
	"AuthDeviceSessionsListError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Auth device session list failed" });
	}
}

export class AuthPasswordResetEmailError extends Schema.TaggedErrorClass<AuthPasswordResetEmailError>()(
	"AuthPasswordResetEmailError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Failed to send password reset email" });
	}
}

export class AuthInvitationEmailError extends Schema.TaggedErrorClass<AuthInvitationEmailError>()(
	"AuthInvitationEmailError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Failed to send invitation email" });
	}
}

export class AuthInvalidSessionPayloadError extends Schema.TaggedErrorClass<AuthInvalidSessionPayloadError>()(
	"AuthInvalidSessionPayloadError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Invalid auth session payload" });
	}
}

export class AuthInvalidDeviceSessionsPayloadError extends Schema.TaggedErrorClass<AuthInvalidDeviceSessionsPayloadError>()(
	"AuthInvalidDeviceSessionsPayloadError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Invalid auth device sessions payload" });
	}
}

export class AuthOrganizationLookupError extends Schema.TaggedErrorClass<AuthOrganizationLookupError>()(
	"AuthOrganizationLookupError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Auth organization lookup failed" });
	}
}

export class AuthInvalidOrganizationPayloadError extends Schema.TaggedErrorClass<AuthInvalidOrganizationPayloadError>()(
	"AuthInvalidOrganizationPayloadError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Invalid auth organization payload" });
	}
}

export class AuthInvalidTeamPayloadError extends Schema.TaggedErrorClass<AuthInvalidTeamPayloadError>()(
	"AuthInvalidTeamPayloadError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Invalid auth team payload" });
	}
}

export class AuthDuplicateOrganizationNameError extends Schema.TaggedErrorClass<AuthDuplicateOrganizationNameError>()(
	"AuthDuplicateOrganizationNameError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Organization name already exists" });
	}
}

export class AuthTeamLookupError extends Schema.TaggedErrorClass<AuthTeamLookupError>()(
	"AuthTeamLookupError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Auth team lookup failed" });
	}
}

export class AuthDuplicateTeamNameError extends Schema.TaggedErrorClass<AuthDuplicateTeamNameError>()(
	"AuthDuplicateTeamNameError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Team name already exists" });
	}
}

export const AuthErrors = [
	AuthHandlerError,
	AuthSessionLookupError,
	AuthDeviceSessionsListError,
	AuthPasswordResetEmailError,
	AuthInvitationEmailError,
	AuthInvalidSessionPayloadError,
	AuthInvalidDeviceSessionsPayloadError,
	AuthOrganizationLookupError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidTeamPayloadError,
	AuthDuplicateOrganizationNameError,
	AuthTeamLookupError,
	AuthDuplicateTeamNameError,
] as const;

export const AuthError = Schema.Union(AuthErrors);
