import * as Schema from "effect/Schema";

export class AuthHandlerError extends Schema.TaggedErrorClass<AuthHandlerError>()(
	"AuthHandlerError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthHandlerError({ message: "Auth handler failed." });
	}
}

export class AuthSessionLookupError extends Schema.TaggedErrorClass<AuthSessionLookupError>()(
	"AuthSessionLookupError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthSessionLookupError({ message: "Auth session lookup failed." });
	}
}

class AuthDeviceSessionsListError extends Schema.TaggedErrorClass<AuthDeviceSessionsListError>()(
	"AuthDeviceSessionsListError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthDeviceSessionsListError({ message: "Auth device session list failed." });
	}
}

export class AuthInvitationEmailError extends Schema.TaggedErrorClass<AuthInvitationEmailError>()(
	"AuthInvitationEmailError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthInvitationEmailError({ message: "Failed to send invitation email." });
	}
}

export class AuthVerificationEmailError extends Schema.TaggedErrorClass<AuthVerificationEmailError>()(
	"AuthVerificationEmailError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthVerificationEmailError({ message: "Failed to send verification email." });
	}
}

export class AuthInvalidSessionPayloadError extends Schema.TaggedErrorClass<AuthInvalidSessionPayloadError>()(
	"AuthInvalidSessionPayloadError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthInvalidSessionPayloadError({ message: "Invalid auth session payload." });
	}
}

class AuthInvalidDeviceSessionsPayloadError extends Schema.TaggedErrorClass<AuthInvalidDeviceSessionsPayloadError>()(
	"AuthInvalidDeviceSessionsPayloadError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthInvalidDeviceSessionsPayloadError({
			message: "Invalid auth device sessions payload.",
		});
	}
}

export class AuthOrganizationLookupError extends Schema.TaggedErrorClass<AuthOrganizationLookupError>()(
	"AuthOrganizationLookupError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthOrganizationLookupError({ message: "Auth organization lookup failed." });
	}
}

export class AuthPermissionLookupError extends Schema.TaggedErrorClass<AuthPermissionLookupError>()(
	"AuthPermissionLookupError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthPermissionLookupError({ message: "Auth permission lookup failed." });
	}
}

export class AuthInvalidOrganizationPayloadError extends Schema.TaggedErrorClass<AuthInvalidOrganizationPayloadError>()(
	"AuthInvalidOrganizationPayloadError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthInvalidOrganizationPayloadError({
			message: "Invalid auth organization payload.",
		});
	}
}

class AuthInvalidTeamPayloadError extends Schema.TaggedErrorClass<AuthInvalidTeamPayloadError>()(
	"AuthInvalidTeamPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 400 },
) {
	static new() {
		return new AuthInvalidTeamPayloadError({ message: "Invalid auth team payload." });
	}
}

export class AuthDuplicateOrganizationNameError extends Schema.TaggedErrorClass<AuthDuplicateOrganizationNameError>()(
	"AuthDuplicateOrganizationNameError",
	{ message: Schema.String },
	{ httpApiStatus: 409 },
) {
	static new() {
		return new AuthDuplicateOrganizationNameError({
			message: "Organization name already exists.",
		});
	}
}

class AuthTeamLookupError extends Schema.TaggedErrorClass<AuthTeamLookupError>()(
	"AuthTeamLookupError",
	{ message: Schema.String },
) {
	static new() {
		return new AuthTeamLookupError({ message: "Auth team lookup failed." });
	}
}

export class AuthDuplicateTeamNameError extends Schema.TaggedErrorClass<AuthDuplicateTeamNameError>()(
	"AuthDuplicateTeamNameError",
	{ message: Schema.String },
	{ httpApiStatus: 409 },
) {
	static new() {
		return new AuthDuplicateTeamNameError({ message: "Team name already exists." });
	}
}

export const AuthError = Schema.Union([
	AuthHandlerError,
	AuthSessionLookupError,
	AuthDeviceSessionsListError,
	AuthInvitationEmailError,
	AuthVerificationEmailError,
	AuthInvalidSessionPayloadError,
	AuthInvalidDeviceSessionsPayloadError,
	AuthOrganizationLookupError,
	AuthPermissionLookupError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidTeamPayloadError,
	AuthDuplicateOrganizationNameError,
	AuthTeamLookupError,
	AuthDuplicateTeamNameError,
]);
