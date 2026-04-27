import { Layer } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

import * as Auth from "@leuchtturm/core/auth/errors";
import * as Billing from "@leuchtturm/core/billing/errors";
import * as Core from "@leuchtturm/core/errors";

export const Errors = [...Core.Errors, ...Auth.Errors, ...Billing.Errors] as const;

export class ErrorCatalog extends HttpApiMiddleware.Service<ErrorCatalog>()("ErrorCatalog", {
	error: Errors,
}) {}

export const errorCatalogLayer = Layer.succeed(ErrorCatalog, (httpApp) => httpApp);
