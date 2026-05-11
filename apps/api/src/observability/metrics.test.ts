import * as Effect from "effect/Effect";
import { PrometheusMetrics } from "effect/unstable/observability";
import { describe, expect, it } from "vite-plus/test";

import { Metrics } from "@leuchtturm/api/observability/metrics";

describe("Metrics", () => {
	it("records counters, gauges, and histograms through the service context", async () => {
		const output = await Effect.runPromise(
			Effect.gen(function* () {
				const metrics = yield* Metrics.Service;

				yield* metrics.action("billing.checkout", "success");
				yield* Metrics.trackAction("zero.query", Effect.void);
				yield* Metrics.trackAction("zero.mutate", Effect.fail("boom")).pipe(
					Effect.catchIf(
						() => true,
						() => Effect.void,
					),
				);
				yield* Metrics.action("billing.checkout", "failure");
				yield* Metrics.setGauge("api_queue_depth", 7, {
					attributes: { queue: "email" },
					description: "Current API queue depth.",
				});
				yield* Metrics.observe("api_action_duration_ms", 125, {
					attributes: { action: "billing.checkout" },
					boundaries: [100, 250],
					description: "API action duration in milliseconds.",
				});

				return yield* PrometheusMetrics.format();
			}).pipe(Effect.provide(Metrics.layer)),
		);

		expect(output).toContain(
			"# HELP api_action_total API actions completed by action name and result.",
		);
		expect(output).toContain("# TYPE api_action_total counter");
		expect(output).toContain('api_action_total{action="billing.checkout",result="success"} 1');
		expect(output).toContain('api_action_total{action="billing.checkout",result="failure"} 1');
		expect(output).toContain('api_action_total{action="zero.query",result="success"} 1');
		expect(output).toContain('api_action_total{action="zero.mutate",result="failure"} 1');
		expect(output).toContain("# TYPE api_queue_depth gauge");
		expect(output).toContain('api_queue_depth{queue="email"} 7');
		expect(output).toContain("# TYPE api_action_duration_ms histogram");
		expect(output).toContain('api_action_duration_ms_bucket{action="billing.checkout",le="100"} 0');
		expect(output).toContain('api_action_duration_ms_bucket{action="billing.checkout",le="250"} 1');
		expect(output).toContain('api_action_duration_ms_count{action="billing.checkout"} 1');
	});
});
