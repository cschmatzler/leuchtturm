import { Effect, Layer, ServiceMap } from "effect";
import { PostHog } from "posthog-node/edge";
import { Resource } from "sst";

export namespace ApiAnalytics {
	const requestProperties = (
		request: Request,
		properties: Record<string, unknown> = {},
	): Record<string, unknown> => {
		const url = new URL(request.url);

		return {
			method: request.method,
			path: url.pathname,
			...properties,
		};
	};

	const createClient = (waitUntil?: (promise: Promise<unknown>) => void) => {
		const resources = Resource as unknown as {
			readonly PostHogHost?: {
				readonly value?: string;
			};
			readonly PostHogProjectApiKey?: {
				readonly value?: string;
			};
		};
		const apiKey = resources.PostHogProjectApiKey?.value;
		const host = resources.PostHogHost?.value;

		if (!apiKey || !host) {
			return undefined;
		}

		return new PostHog(apiKey, {
			host,
			waitUntil,
		});
	};

	export interface Interface {
		readonly captureRequest: (
			request: Request,
			response: Response,
			durationMs: number,
		) => Effect.Effect<void>;
		readonly captureException: (
			error: unknown,
			request: Request,
			properties?: Record<string, unknown>,
		) => Effect.Effect<void>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@leuchtturm/ApiAnalytics",
	) {}

	export const layer = (waitUntil?: (promise: Promise<unknown>) => void) =>
		Layer.effect(
			Service,
			Effect.sync(() => {
				const client = createClient(waitUntil);

				return Service.of({
					captureRequest: (request, response, durationMs) =>
						Effect.sync(() => {
							if (!client) {
								return;
							}

							const path = new URL(request.url).pathname;
							if (path === "/health") {
								return;
							}

							client.capture({
								distinctId: "api",
								event: "api request completed",
								properties: requestProperties(request, {
									duration_ms: durationMs,
									ok: response.ok,
									status: response.status,
									status_group: `${Math.floor(response.status / 100)}xx`,
								}),
							});
						}),
					captureException: (error, request, properties = {}) =>
						!client
							? Effect.succeed(undefined)
							: Effect.tryPromise({
									try: () =>
										client.captureExceptionImmediate(
											error,
											"api",
											requestProperties(request, properties),
										),
									catch: (error) => String(error),
								}).pipe(Effect.catch(() => Effect.succeed(undefined))),
				});
			}),
		);
}
