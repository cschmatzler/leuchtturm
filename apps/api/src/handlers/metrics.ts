import { Effect } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { metricsText } from "@chevrotain/api/metrics";

export const MetricsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "metrics", (handlers) =>
	handlers.handleRaw("metrics", () =>
		metricsText.pipe(
			Effect.map((body) =>
				HttpServerResponse.text(body, {
					headers: {
						"content-type": "text/plain; version=0.0.4; charset=utf-8",
					},
				}),
			),
		),
	),
);
