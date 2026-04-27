import { Schema } from "effect";

export class AuthHandlerError extends Schema.TaggedErrorClass<AuthHandlerError>()(
	"AuthHandlerError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthSessionLookupError extends Schema.TaggedErrorClass<AuthSessionLookupError>()(
	"AuthSessionLookupError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthDeviceSessionsListError extends Schema.TaggedErrorClass<AuthDeviceSessionsListError>()(
	"AuthDeviceSessionsListError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthPasswordResetEmailError extends Schema.TaggedErrorClass<AuthPasswordResetEmailError>()(
	"AuthPasswordResetEmailError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthInvalidSessionPayloadError extends Schema.TaggedErrorClass<AuthInvalidSessionPayloadError>()(
	"AuthInvalidSessionPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthOrganizationLookupError extends Schema.TaggedErrorClass<AuthOrganizationLookupError>()(
	"AuthOrganizationLookupError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthInvalidOrganizationPayloadError extends Schema.TaggedErrorClass<AuthInvalidOrganizationPayloadError>()(
	"AuthInvalidOrganizationPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthInvalidTeamPayloadError extends Schema.TaggedErrorClass<AuthInvalidTeamPayloadError>()(
	"AuthInvalidTeamPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 400 },
) {}

export class AuthTeamLookupError extends Schema.TaggedErrorClass<AuthTeamLookupError>()(
	"AuthTeamLookupError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class AuthDuplicateTeamSlugError extends Schema.TaggedErrorClass<AuthDuplicateTeamSlugError>()(
	"AuthDuplicateTeamSlugError",
	{ message: Schema.String },
	{ httpApiStatus: 409 },
) {}

export const AuthError = Schema.Union([
	AuthHandlerError,
	AuthSessionLookupError,
	AuthDeviceSessionsListError,
	AuthPasswordResetEmailError,
	AuthInvalidSessionPayloadError,
	AuthOrganizationLookupError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidTeamPayloadError,
	AuthTeamLookupError,
	AuthDuplicateTeamSlugError,
]);
