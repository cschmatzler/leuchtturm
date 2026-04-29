import { Schema } from "effect";

export class BillingPolarRequestError extends Schema.TaggedErrorClass<BillingPolarRequestError>()(
	"BillingPolarRequestError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly operation: string }) {
		super({ ...params, message: `Polar request failed: ${params.operation}` });
	}
}

export class BillingPersistenceError extends Schema.TaggedErrorClass<BillingPersistenceError>()(
	"BillingPersistenceError",
	{
		operation: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly operation: string }) {
		super({ ...params, message: params.operation });
	}
}

export class BillingInvalidSnapshotError extends Schema.TaggedErrorClass<BillingInvalidSnapshotError>()(
	"BillingInvalidSnapshotError",
	{
		resource: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly resource: string }) {
		super({ ...params, message: `Invalid billing ${params.resource} snapshot` });
	}
}

export class BillingMissingExternalOrganizationError extends Schema.TaggedErrorClass<BillingMissingExternalOrganizationError>()(
	"BillingMissingExternalOrganizationError",
	{
		resource: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly resource: string }) {
		super({
			...params,
			message: `Polar ${params.resource} webhook payload is missing an external organization id`,
		});
	}
}

export class BillingUnknownOrganizationError extends Schema.TaggedErrorClass<BillingUnknownOrganizationError>()(
	"BillingUnknownOrganizationError",
	{
		resource: Schema.String,
		externalId: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly resource: string; readonly externalId: string }) {
		super({
			...params,
			message: `Polar ${params.resource} webhook references unknown local organization: ${params.externalId}`,
		});
	}
}

export class BillingOrganizationLookupError extends Schema.TaggedErrorClass<BillingOrganizationLookupError>()(
	"BillingOrganizationLookupError",
	{
		externalId: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly externalId: string }) {
		super({ ...params, message: `Failed to look up organization ${params.externalId}` });
	}
}

export class BillingSubscriptionOwnershipMismatchError extends Schema.TaggedErrorClass<BillingSubscriptionOwnershipMismatchError>()(
	"BillingSubscriptionOwnershipMismatchError",
	{
		orderId: Schema.String,
		subscriptionId: Schema.String,
		subscriptionCustomerId: Schema.optional(Schema.String),
		orderCustomerId: Schema.optional(Schema.String),
		message: Schema.String,
	},
) {
	constructor(
		params: {
			readonly orderId: string;
			readonly subscriptionId: string;
		} & (
			| {
					readonly kind: "local";
			  }
			| {
					readonly kind: "snapshot";
					readonly subscriptionCustomerId: string;
					readonly orderCustomerId: string;
			  }
		),
	) {
		const { kind: _, ...fields } = params;
		super({
			...fields,
			message:
				params.kind === "local"
					? `Polar order ${params.orderId} references subscription ${params.subscriptionId} with mismatched local ownership`
					: `Polar order ${params.orderId} subscription customer ${params.subscriptionCustomerId} does not match order customer ${params.orderCustomerId}`,
		});
	}
}

export class BillingMissingSubscriptionSnapshotError extends Schema.TaggedErrorClass<BillingMissingSubscriptionSnapshotError>()(
	"BillingMissingSubscriptionSnapshotError",
	{
		orderId: Schema.String,
		subscriptionId: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: { readonly orderId: string; readonly subscriptionId: string }) {
		super({
			...params,
			message: `Polar order ${params.orderId} references subscription ${params.subscriptionId} before its snapshot is available`,
		});
	}
}

export class BillingSubscriptionReferenceMismatchError extends Schema.TaggedErrorClass<BillingSubscriptionReferenceMismatchError>()(
	"BillingSubscriptionReferenceMismatchError",
	{
		orderId: Schema.String,
		embeddedSubscriptionId: Schema.String,
		referencedSubscriptionId: Schema.String,
		message: Schema.String,
	},
) {
	constructor(params: {
		readonly orderId: string;
		readonly embeddedSubscriptionId: string;
		readonly referencedSubscriptionId: string;
	}) {
		super({
			...params,
			message: `Polar order ${params.orderId} embeds subscription ${params.embeddedSubscriptionId} but references ${params.referencedSubscriptionId}`,
		});
	}
}

export const BillingErrors = [
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

export const BillingError = Schema.Union(BillingErrors);

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
