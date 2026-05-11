import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";

export namespace Metrics {
	export type Attributes = Readonly<Record<string, string>> | ReadonlyArray<[string, string]>;

	export interface CounterOptions {
		readonly description?: string;
		readonly attributes?: Attributes;
	}

	export interface GaugeOptions {
		readonly description?: string;
		readonly attributes?: Attributes;
	}

	export interface HistogramOptions {
		readonly description?: string;
		readonly attributes?: Attributes;
		readonly boundaries: ReadonlyArray<number>;
	}

	export interface Interface {
		readonly increment: (
			name: string,
			value?: number,
			options?: CounterOptions,
		) => Effect.Effect<void>;
		readonly setGauge: (name: string, value: number, options?: GaugeOptions) => Effect.Effect<void>;
		readonly observe: (
			name: string,
			value: number,
			options: HistogramOptions,
		) => Effect.Effect<void>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/api/observability/Metrics",
	) {}

	export const requestDurationBoundaries = Metric.exponentialBoundaries({
		start: 0.5,
		factor: 2,
		count: 35,
	});

	export const layer = Layer.succeed(
		Service,
		Service.of({
			increment: (name, value = 1, options) =>
				Metric.update(
					Metric.counter(name, {
						attributes: options?.attributes,
						description: options?.description,
						incremental: true,
					}),
					value,
				),
			setGauge: (name, value, options) =>
				Metric.update(
					Metric.gauge(name, {
						attributes: options?.attributes,
						description: options?.description,
					}),
					value,
				),
			observe: (name, value, options) =>
				Metric.update(
					Metric.histogram(name, {
						attributes: options.attributes,
						boundaries: options.boundaries,
						description: options.description,
					}),
					value,
				),
		}),
	);

	export const increment = (name: string, value?: number, options?: CounterOptions) =>
		Effect.gen(function* () {
			const metrics = yield* Service;
			yield* metrics.increment(name, value, options);
		});

	export const setGauge = (name: string, value: number, options?: GaugeOptions) =>
		Effect.gen(function* () {
			const metrics = yield* Service;
			yield* metrics.setGauge(name, value, options);
		});

	export const observe = (name: string, value: number, options: HistogramOptions) =>
		Effect.gen(function* () {
			const metrics = yield* Service;
			yield* metrics.observe(name, value, options);
		});
}
