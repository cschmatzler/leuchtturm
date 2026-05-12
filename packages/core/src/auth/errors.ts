import * as Schema from "effect/Schema";

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

export class AuthInvitationEmailError extends Schema.TaggedErrorClass<AuthInvitationEmailError>()(
	"AuthInvitationEmailError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Failed to send invitation email" });
	}
}

export class AuthMagicLinkEmailError extends Schema.TaggedErrorClass<AuthMagicLinkEmailError>()(
	"AuthMagicLinkEmailError",
	{ message: Schema.String },
) {
	constructor() {
		super({ message: "Failed to send magic link email" });
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

class AuthInvalidTeamPayloadError extends Schema.TaggedErrorClass<AuthInvalidTeamPayloadError>()(
	"AuthInvalidTeamPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 400 },
) {
	constructor() {
		super({ message: "Invalid auth team payload" });
	}
}

export class AuthDuplicateOrganizationNameError extends Schema.TaggedErrorClass<AuthDuplicateOrganizationNameError>()(
	"AuthDuplicateOrganizationNameError",
	{ message: Schema.String },
	{ httpApiStatus: 409 },
) {
	constructor() {
		super({ message: "Organization name already exists" });
	}
}

class AuthTeamLookupError extends Schema.TaggedErrorClass<AuthTeamLookupError>()(
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
	{ httpApiStatus: 409 },
) {
	constructor() {
		super({ message: "Team name already exists" });
	}
}

export const AuthError = Schema.Union([
	AuthHandlerError,
	AuthSessionLookupError,
	AuthDeviceSessionsListError,
	AuthInvitationEmailError,
	AuthMagicLinkEmailError,
	AuthInvalidSessionPayloadError,
	AuthInvalidDeviceSessionsPayloadError,
	AuthOrganizationLookupError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidTeamPayloadError,
	AuthDuplicateOrganizationNameError,
	AuthTeamLookupError,
	AuthDuplicateTeamNameError,
]);
