import { Schema } from "effect";

export class AuthProviderError extends Schema.TaggedErrorClass<AuthProviderError>()(
	"AuthProviderError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
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

export class AuthInvalidDeviceSessionsPayloadError extends Schema.TaggedErrorClass<AuthInvalidDeviceSessionsPayloadError>()(
	"AuthInvalidDeviceSessionsPayloadError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export const AuthError = Schema.Union([
	AuthProviderError,
	AuthInvalidSessionPayloadError,
	AuthOrganizationLookupError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidDeviceSessionsPayloadError,
]);
