import { httpInstrumentationMiddleware } from "@hono/otel";
import { prometheus } from "@hono/prometheus";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Effect } from "effect";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { register } from "prom-client";

import analytics from "@chevrotain/api/analytics/index";
import autumn from "@chevrotain/api/autumn";
import errors from "@chevrotain/api/errors/index";
import {
	isTaggedError,
	taggedErrorToResponse,
	taggedErrorToStatus,
} from "@chevrotain/api/errors/mapping";
import mutate from "@chevrotain/api/mutate";
import query from "@chevrotain/api/query";
import { runEffectFork } from "@chevrotain/api/runtime";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { auth } from "@chevrotain/core/auth/index";
import { PublicError } from "@chevrotain/core/result";

const baseUrl = process.env.BASE_URL;
if (!baseUrl) {
	throw new Error("BASE_URL environment variable is required");
}

const { printMetrics, registerMetrics } = prometheus({
	collectDefaultMetrics: true,
	registry: register,
});

const app = new Hono()
	.basePath("/api")
	.use(httpInstrumentationMiddleware())
	.use(registerMetrics)
	.use(
		cors({
			origin: baseUrl,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			credentials: true,
			maxAge: 600,
		}),
	)

	.get("/metrics", printMetrics)
	.get("/up", (c) => c.json({ success: true }))
	.all("/auth/*", (c) => auth.handler(c.req.raw))
	.route("/autumn", autumn)
	.route("/query", query)
	.route("/mutate", mutate)
	.route("/analytics", analytics)
	.route("/errors", errors)
	.onError((error, c) => {
		// Effect TaggedErrors (from Effect-managed handlers)
		if (isTaggedError(error)) {
			const status = taggedErrorToStatus(error);

			if (status === 500) {
				const span = trace.getActiveSpan();
				if (span) {
					const errorMessage =
						"message" in error && typeof error.message === "string" ? error.message : error._tag;
					span.recordException(error instanceof Error ? error : new Error(errorMessage));
					span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
				}

				runEffectFork(
					Effect.gen(function* () {
						const analytics = yield* ClickHouseService;
						yield* analytics.insertErrors([
							{
								source: "api",
								errorType: error._tag,
								message:
									"message" in error && typeof error.message === "string"
										? error.message
										: error._tag,
								url: c.req.path,
								method: c.req.method,
								statusCode: 500,
								userAgent: c.req.header("user-agent"),
							},
						]);
					}),
				);
			}

			return c.json({ success: false, error: taggedErrorToResponse(error) }, status);
		}

		// Legacy PublicError (from Zero mutators)
		if (error instanceof PublicError) {
			return c.json(
				{
					success: false,
					error: {
						global: error.global,
						fields: error.fields,
					},
				},
				(error.status ?? 500) as ContentfulStatusCode,
			);
		}

		// Unhandled defects
		const normalizedError =
			error instanceof Error
				? error
				: new Error(typeof error === "string" ? error : JSON.stringify(error));

		const span = trace.getActiveSpan();
		if (span) {
			span.recordException(normalizedError);
			span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
		}

		runEffectFork(
			Effect.gen(function* () {
				const analytics = yield* ClickHouseService;
				yield* analytics.insertErrors([
					{
						source: "api",
						errorType: normalizedError.name,
						message: normalizedError.message,
						stackTrace: normalizedError.stack,
						url: c.req.path,
						method: c.req.method,
						statusCode: 500,
						userAgent: c.req.header("user-agent"),
					},
				]);
			}),
		);

		return c.json(
			{
				success: false,
				error: {
					global: [
						{
							code: "internal",
							message: "Internal server error",
						},
					],
					fields: [],
				},
			},
			500,
		);
	})
	.notFound((c) =>
		c.json(
			{
				success: false,
				error: {
					global: [
						{
							code: "not_found",
							message: "Resource not found",
						},
					],
					fields: [],
				},
			},
			404,
		),
	);

export type Routes = typeof app;
export { app };
