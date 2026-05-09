import * as Layer from "effect/Layer";
import * as HttpApiMiddleware from "effect/unstable/httpapi/HttpApiMiddleware";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";

import {
	AuthDeviceSessionsListError,
	AuthDuplicateOrganizationNameError,
	AuthDuplicateTeamNameError,
	AuthHandlerError,
	AuthInvalidDeviceSessionsPayloadError,
	AuthInvalidOrganizationPayloadError,
	AuthInvalidSessionPayloadError,
	AuthInvalidTeamPayloadError,
	AuthInvitationEmailError,
	AuthMagicLinkEmailError,
	AuthOrganizationLookupError,
	AuthSessionLookupError,
	AuthTeamLookupError,
} from "@leuchtturm/core/auth/errors";
import {
	BillingInvalidSnapshotError,
	BillingMissingExternalOrganizationError,
	BillingMissingSubscriptionSnapshotError,
	BillingOrganizationLookupError,
	BillingPersistenceError,
	BillingPolarRequestError,
	BillingSubscriptionOwnershipMismatchError,
	BillingSubscriptionReferenceMismatchError,
	BillingUnknownOrganizationError,
} from "@leuchtturm/core/billing/errors";
import {
	DatabaseError,
	ForbiddenError,
	InternalServerError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from "@leuchtturm/core/errors";

export const Errors = [
	HttpApiSchema.status(400)(ValidationError),
	HttpApiSchema.status(401)(UnauthorizedError),
	HttpApiSchema.status(403)(ForbiddenError),
	HttpApiSchema.status(404)(NotFoundError),
	HttpApiSchema.status(500)(DatabaseError),
	HttpApiSchema.status(500)(InternalServerError),
	HttpApiSchema.status(500)(AuthHandlerError),
	HttpApiSchema.status(500)(AuthSessionLookupError),
	HttpApiSchema.status(500)(AuthDeviceSessionsListError),
	HttpApiSchema.status(500)(AuthInvitationEmailError),
	HttpApiSchema.status(500)(AuthMagicLinkEmailError),
	HttpApiSchema.status(500)(AuthInvalidSessionPayloadError),
	HttpApiSchema.status(500)(AuthInvalidDeviceSessionsPayloadError),
	HttpApiSchema.status(500)(AuthOrganizationLookupError),
	HttpApiSchema.status(500)(AuthInvalidOrganizationPayloadError),
	HttpApiSchema.status(409)(AuthDuplicateOrganizationNameError),
	HttpApiSchema.status(400)(AuthInvalidTeamPayloadError),
	HttpApiSchema.status(500)(AuthTeamLookupError),
	HttpApiSchema.status(409)(AuthDuplicateTeamNameError),
	HttpApiSchema.status(500)(BillingPolarRequestError),
	HttpApiSchema.status(500)(BillingPersistenceError),
	HttpApiSchema.status(500)(BillingInvalidSnapshotError),
	HttpApiSchema.status(500)(BillingMissingExternalOrganizationError),
	HttpApiSchema.status(500)(BillingUnknownOrganizationError),
	HttpApiSchema.status(500)(BillingOrganizationLookupError),
	HttpApiSchema.status(500)(BillingSubscriptionOwnershipMismatchError),
	HttpApiSchema.status(500)(BillingMissingSubscriptionSnapshotError),
	HttpApiSchema.status(500)(BillingSubscriptionReferenceMismatchError),
] as const;

export class ErrorCatalog extends HttpApiMiddleware.Service<ErrorCatalog>()("ErrorCatalog", {
	error: Errors,
}) {}

export namespace ErrorCatalog {
	export const layer = Layer.succeed(ErrorCatalog, (httpApp) => httpApp);
}
