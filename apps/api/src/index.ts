import { httpInstrumentationMiddleware } from "@hono/otel";
import { prometheus } from "@hono/prometheus";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { register } from "prom-client";

import analytics from "@one/api/analytics/index";
import autumn from "@one/api/autumn";
import errors from "@one/api/errors/index";
import mutate from "@one/api/mutate";
import query from "@one/api/query";
import { insertErrors } from "@one/core/analytics/clickhouse";
import { auth } from "@one/core/auth/index";
import { PublicError } from "@one/core/result";

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
			origin: process.env.BASE_URL!,
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

		const normalizedError =
			error instanceof Error
				? error
				: new Error(typeof error === "string" ? error : JSON.stringify(error));

		const span = trace.getActiveSpan();
		if (span) {
			span.recordException(normalizedError);
			span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
		}

		insertErrors([
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
		]).catch(() => {});

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
