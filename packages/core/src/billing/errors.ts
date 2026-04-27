import { Schema } from "effect";

export class BillingPolarRequestError extends Schema.TaggedErrorClass<BillingPolarRequestError>()(
	"BillingPolarRequestError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class BillingPersistenceError extends Schema.TaggedErrorClass<BillingPersistenceError>()(
	"BillingPersistenceError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class BillingInvalidSnapshotError extends Schema.TaggedErrorClass<BillingInvalidSnapshotError>()(
	"BillingInvalidSnapshotError",
	{
		resource: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class BillingMissingExternalOrganizationError extends Schema.TaggedErrorClass<BillingMissingExternalOrganizationError>()(
	"BillingMissingExternalOrganizationError",
	{
		resource: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class BillingUnknownOrganizationError extends Schema.TaggedErrorClass<BillingUnknownOrganizationError>()(
	"BillingUnknownOrganizationError",
	{
		resource: Schema.String,
		externalId: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class BillingOrganizationLookupError extends Schema.TaggedErrorClass<BillingOrganizationLookupError>()(
	"BillingOrganizationLookupError",
	{
		externalId: Schema.String,
		message: Schema.String,
	},
	{ httpApiStatus: 500 },
) {}

export class BillingSubscriptionOwnershipMismatchError extends Schema.TaggedErrorClass<BillingSubscriptionOwnershipMismatchError>()(
	"BillingSubscriptionOwnershipMismatchError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class BillingMissingSubscriptionSnapshotError extends Schema.TaggedErrorClass<BillingMissingSubscriptionSnapshotError>()(
	"BillingMissingSubscriptionSnapshotError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export class BillingSubscriptionReferenceMismatchError extends Schema.TaggedErrorClass<BillingSubscriptionReferenceMismatchError>()(
	"BillingSubscriptionReferenceMismatchError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export const Errors = [
	BillingPolarRequestError,
	BillingPersistenceError,
	BillingInvalidSnapshotError,
	BillingMissingExternalOrganizationError,
	BillingUnknownOrganizationError,
	BillingOrganizationLookupError,
	BillingSubscriptionOwnershipMismatchError,
	BillingMissingSubscriptionSnapshotError,
	BillingSubscriptionReferenceMismatchError,
] as const;

export const BillingError = Schema.Union(Errors);

export type BillingErrorType =
	| BillingPolarRequestError
	| BillingPersistenceError
	| BillingInvalidSnapshotError
	| BillingMissingExternalOrganizationError
	| BillingUnknownOrganizationError
	| BillingOrganizationLookupError
	| BillingSubscriptionOwnershipMismatchError
	| BillingMissingSubscriptionSnapshotError
	| BillingSubscriptionReferenceMismatchError;
