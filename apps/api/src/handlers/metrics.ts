import * as Effect from "effect/Effect";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";

export namespace MetricsHandler {
	export const prometheus = Metrics.formatPrometheus().pipe(
		Effect.map((body) =>
			HttpServerResponse.text(body, {
				contentType: "text/plain; version=0.0.4; charset=utf-8",
			}),
		),
	);

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "metrics", (handlers) =>
		handlers.handleRaw("prometheus", () => prometheus),
	);
}
