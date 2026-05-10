import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";

import { Telemetry } from "@leuchtturm/api/observability/telemetry";

export namespace Observability {
	export const middleware = HttpMiddleware.make((app) =>
		app.pipe(HttpMiddleware.tracer, HttpMiddleware.logger, Telemetry.withRequest),
	);
}
