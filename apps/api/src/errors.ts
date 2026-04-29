import { Layer } from "effect";
import { HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi";

import * as Auth from "@leuchtturm/core/auth/errors";
import * as Billing from "@leuchtturm/core/billing/errors";
import * as Core from "@leuchtturm/core/errors";

export const Errors = [
	HttpApiSchema.status(400)(Core.ValidationError),
	HttpApiSchema.status(401)(Core.UnauthorizedError),
	HttpApiSchema.status(403)(Core.ForbiddenError),
	HttpApiSchema.status(404)(Core.NotFoundError),
	HttpApiSchema.status(500)(Core.DatabaseError),
	HttpApiSchema.status(500)(Core.InternalServerError),
	HttpApiSchema.status(500)(Auth.AuthHandlerError),
	HttpApiSchema.status(500)(Auth.AuthSessionLookupError),
	HttpApiSchema.status(500)(Auth.AuthDeviceSessionsListError),
	HttpApiSchema.status(500)(Auth.AuthPasswordResetEmailError),
	HttpApiSchema.status(500)(Auth.AuthInvitationEmailError),
	HttpApiSchema.status(500)(Auth.AuthInvalidSessionPayloadError),
	HttpApiSchema.status(500)(Auth.AuthInvalidDeviceSessionsPayloadError),
	HttpApiSchema.status(500)(Auth.AuthOrganizationLookupError),
	HttpApiSchema.status(500)(Auth.AuthInvalidOrganizationPayloadError),
	HttpApiSchema.status(400)(Auth.AuthInvalidTeamPayloadError),
	HttpApiSchema.status(500)(Auth.AuthTeamLookupError),
	HttpApiSchema.status(409)(Auth.AuthDuplicateTeamNameError),
	HttpApiSchema.status(500)(Billing.BillingPolarRequestError),
	HttpApiSchema.status(500)(Billing.BillingPersistenceError),
	HttpApiSchema.status(500)(Billing.BillingInvalidSnapshotError),
	HttpApiSchema.status(500)(Billing.BillingMissingExternalOrganizationError),
	HttpApiSchema.status(500)(Billing.BillingUnknownOrganizationError),
	HttpApiSchema.status(500)(Billing.BillingOrganizationLookupError),
	HttpApiSchema.status(500)(Billing.BillingSubscriptionOwnershipMismatchError),
	HttpApiSchema.status(500)(Billing.BillingMissingSubscriptionSnapshotError),
	HttpApiSchema.status(500)(Billing.BillingSubscriptionReferenceMismatchError),
] as const;

export class ErrorCatalog extends HttpApiMiddleware.Service<ErrorCatalog>()("ErrorCatalog", {
	error: Errors,
}) {}

export namespace ErrorCatalog {
	export const layer = Layer.succeed(ErrorCatalog, (httpApp) => httpApp);
}
