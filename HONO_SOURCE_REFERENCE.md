# Complete Hono API Source Code Reference

This document contains all source files in full for the Hono to @effect/platform migration.

---

## apps/api/src/index.ts

```typescript
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
```

---

## apps/api/src/server.ts

```typescript
import { serve } from "@hono/node-server";

import { stopRateLimitCleanup } from "@chevrotain/api/errors/index";
import { app } from "@chevrotain/api/index";
import { shutdownTelemetry } from "@chevrotain/api/instrumentation";
import { shutdownRuntime } from "@chevrotain/api/runtime";

const port = Number(process.env.PORT!);
const server = serve({
	port,
	fetch: app.fetch,
});

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	server.close();
	stopRateLimitCleanup();
	await shutdownRuntime(); // closes DB pool, ClickHouse client, etc.
	await shutdownTelemetry();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

---

## apps/api/src/query.ts

```typescript
import { mustGetQuery, type ReadonlyJSONValue } from "@rocicorp/zero";
import { handleQueryRequest } from "@rocicorp/zero/server";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post("/", async (c) => {
	const user = c.get("user");

	const result = await handleQueryRequest(
		(name: string, args: ReadonlyJSONValue | undefined) => {
			const query = mustGetQuery(queries, name);
			return query.fn({ args, ctx: { userId: user.id } });
		},
		schema,
		c.req.raw,
	);

	return c.json(result);
});

export default app;
```

---

## apps/api/src/mutate.ts

```typescript
import { mustGetMutator } from "@rocicorp/zero";
import { handleMutateRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";
import { db } from "@chevrotain/core/drizzle/index";
import { mutators } from "@chevrotain/zero/mutators";
import { schema } from "@chevrotain/zero/schema";

const dbProvider = zeroDrizzle(schema, db);

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post("/", async (c) => {
	const user = c.get("user");
	const ctx = { userId: user.id };

	const result = await handleMutateRequest(
		dbProvider,
		async (transact) => {
			return await transact(async (tx, name, args) => {
				const mutator = mustGetMutator(mutators, name);
				return await mutator.fn({ tx, ctx, args });
			});
		},
		c.req.raw,
	);

	return c.json(result);
});

export default app;
```

---

## apps/api/src/autumn.ts

```typescript
import { autumnHandler } from "autumn-js/backend";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).all("/*", async (c) => {
	const user = c.get("user");

	const body = c.req.method !== "GET" ? await c.req.json() : null;

	const { statusCode, response } = await autumnHandler({
		customerId: user.id,
		customerData: {
			name: user.name,
			email: user.email,
		},
		request: {
			url: c.req.url,
			method: c.req.method,
			body,
		},
	});

	return c.json(response, statusCode as ContentfulStatusCode);
});

export default app;
```

---

## apps/api/src/middleware/auth.ts

```typescript
import { createMiddleware } from "hono/factory";

import { auth } from "@chevrotain/core/auth/index";
import { PublicError } from "@chevrotain/core/result";

type Session = typeof auth.$Infer.Session;

export type AuthVariables = {
	user: Session["user"];
	session: Session["session"];
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		throw new PublicError({ status: 401, global: [{ message: "Unauthorized" }] });
	}

	c.set("user", session.user);
	c.set("session", session.session);

	await next();
});
```

---

## apps/api/src/instrumentation.ts

```typescript
import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const resource = resourceFromAttributes({
	"service.name": "chevrotain-api",
});

const contextManager = new AsyncLocalStorageContextManager();
context.setGlobalContextManager(contextManager);

const tracerProvider = new BasicTracerProvider({
	resource,
	spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
trace.setGlobalTracerProvider(tracerProvider);

registerInstrumentations({
	tracerProvider,
	instrumentations: [new PgInstrumentation(), new UndiciInstrumentation()],
});

export async function shutdownTelemetry() {
	await tracerProvider.shutdown();
}
```

---

## apps/api/src/runtime.ts

```typescript
import { Cause, Effect, Exit, Layer, ManagedRuntime, Result } from "effect";

import { ClickHouseServiceLive } from "@chevrotain/core/analytics/service";
import { BillingServiceLive } from "@chevrotain/core/billing/service";
import { DatabaseServiceLive } from "@chevrotain/core/drizzle/service";
import { EmailServiceLive } from "@chevrotain/core/email/service";

/** All service layers composed into the application layer. */
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	BillingServiceLive,
	EmailServiceLive,
);

/** Managed runtime — created once, lives for the app's lifetime. */
const AppRuntime = ManagedRuntime.make(AppLayer);

/**
 * Run an Effect inside a Hono handler.
 * This is the ONLY place effects should be executed — compose with yield* everywhere else.
 */
export const runEffect = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<typeof AppLayer>>,
): Promise<A> =>
	AppRuntime.runPromiseExit(effect).then((exit) => {
		if (Exit.isFailure(exit)) {
			// Fiber was interrupted (e.g. request cancelled) — surface as a clear error
			if (Cause.hasInterruptsOnly(exit.cause)) {
				throw new Error("Effect interrupted");
			}
			// Re-throw defects (bugs) as regular errors for Hono's .onError
			const defectResult = Cause.findDefect(exit.cause);
			if (Result.isSuccess(defectResult)) {
				throw defectResult.success;
			}
			// Re-throw typed failures — Hono's .onError will catch TaggedErrors
			const errorResult = Cause.findError(exit.cause);
			if (Result.isSuccess(errorResult)) {
				throw errorResult.success;
			}
			throw exit;
		}
		return exit.value;
	});

/**
 * Run an Effect as fire-and-forget from non-Effect contexts (e.g. Hono .onError).
 *
 * Uses console.error for failures because this runs outside the Effect error channel
 * (typically from Hono's .onError) — we can't use Effect to report a failure to run effects.
 */
export const runEffectFork = <E>(
	effect: Effect.Effect<void, E, Layer.Success<typeof AppLayer>>,
): void => {
	AppRuntime.runPromise(effect).catch((error) => {
		console.error("Background effect failed:", error);
	});
};

/**
 * Shutdown the runtime (called on SIGINT/SIGTERM).
 * Closes all managed resources (DB pool, ClickHouse client, etc).
 */
export const shutdownRuntime = () => AppRuntime.dispose();
```

---

## apps/api/src/errors/index.ts

```typescript
import { sValidator } from "@hono/standard-validator";
import { Effect } from "effect";
import { Hono } from "hono";

import { runEffect } from "@chevrotain/api/runtime";
import { ErrorPayload } from "@chevrotain/core/analytics/schema";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitError, ValidationError } from "@chevrotain/core/errors";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
	const now = Date.now();
	const entry = requestCounts.get(ip);

	if (!entry || now >= entry.resetAt) {
		requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}

	entry.count++;
	return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/** Periodically clean up stale entries to prevent unbounded memory growth. */
const cleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of requestCounts) {
		if (now >= entry.resetAt) {
			requestCounts.delete(ip);
		}
	}
}, RATE_LIMIT_WINDOW_MS);

/** Stop the cleanup timer (called during graceful shutdown). */
export function stopRateLimitCleanup(): void {
	clearInterval(cleanupInterval);
}

const app = new Hono().post(
	"/",
	// Throw-at-boundary: sValidator runs in Hono middleware, outside the Effect pipeline.
	// TaggedErrors thrown here are caught by Hono's .onError → isTaggedError → mapped response.
	sValidator("json", ErrorPayload, (result) => {
		if (result.success) {
			return;
		}

		throw new ValidationError({
			global: [{ message: "Invalid error payload" }],
		});
	}),
	async (c) => {
		const ip =
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
			c.req.header("x-real-ip") ??
			"unknown";

		if (isRateLimited(ip)) {
			throw new RateLimitError({ message: "Too many error reports" });
		}

		const payload = c.req.valid("json");

		if (payload.errors.length === 0) {
			return c.json({ success: true });
		}

		const userAgent = c.req.header("user-agent") ?? "";

		await runEffect(
			Effect.gen(function* () {
				const analytics = yield* ClickHouseService;
				yield* analytics.insertErrors(
					payload.errors.map((error) => ({
						source: "web" as const,
						errorType: error.errorType,
						message: error.message,
						stackTrace: error.stackTrace,
						url: error.url,
						userAgent,
						properties: error.properties,
					})),
				);
			}),
		);

		return c.json({ success: true });
	},
);

export default app;
```

---

## apps/api/src/errors/mapping.ts

```typescript
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type {
	BillingError,
	ClickHouseError,
	DatabaseError,
	EmailError,
	ForbiddenError,
	NotFoundError,
	RateLimitError,
	UnauthorizedError,
	ValidationError,
} from "@chevrotain/core/errors";

type TaggedApiError =
	| NotFoundError
	| UnauthorizedError
	| ForbiddenError
	| ValidationError
	| RateLimitError
	| DatabaseError
	| ClickHouseError
	| EmailError
	| BillingError;

/** Compile-time exhaustive: adding a new TaggedApiError without a status entry is a type error. */
const STATUS_MAP = {
	NotFoundError: 404,
	UnauthorizedError: 401,
	ForbiddenError: 403,
	ValidationError: 400,
	RateLimitError: 429,
	DatabaseError: 500,
	ClickHouseError: 500,
	EmailError: 500,
	BillingError: 500,
} as const satisfies Record<TaggedApiError["_tag"], ContentfulStatusCode>;

export function isTaggedError(error: unknown): error is TaggedApiError {
	return (
		typeof error === "object" &&
		error !== null &&
		"_tag" in error &&
		typeof (error as { _tag: unknown })._tag === "string" &&
		(error as { _tag: string })._tag in STATUS_MAP
	);
}

export function taggedErrorToStatus(error: TaggedApiError): ContentfulStatusCode {
	return STATUS_MAP[error._tag] ?? 500;
}

export function taggedErrorToResponse(error: TaggedApiError) {
	switch (error._tag) {
		case "ValidationError":
			return {
				global: error.global ?? [],
				fields: error.fields ?? [],
			};
		case "NotFoundError":
			return {
				global: [{ code: "not_found", message: error.message ?? "Not found" }],
				fields: [],
			};
		case "UnauthorizedError":
			return {
				global: [{ code: "unauthorized", message: error.message ?? "Unauthorized" }],
				fields: [],
			};
		case "ForbiddenError":
			return {
				global: [{ code: "forbidden", message: error.message ?? "Forbidden" }],
				fields: [],
			};
		case "RateLimitError":
			return {
				global: [{ code: "rate_limit", message: error.message ?? "Too many requests" }],
				fields: [],
			};
		default:
			// Infrastructure errors — don't leak internals
			return {
				global: [{ code: "internal", message: "Internal server error" }],
				fields: [],
			};
	}
}
```

---

## apps/api/src/analytics/index.ts

```typescript
import { sValidator } from "@hono/standard-validator";
import { Effect } from "effect";
import { Hono } from "hono";

import { authMiddleware, type AuthVariables } from "@chevrotain/api/middleware/auth";
import { runEffect } from "@chevrotain/api/runtime";
import { AnalyticsPayload } from "@chevrotain/core/analytics/schema";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { ValidationError } from "@chevrotain/core/errors";

const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post(
	"/",
	// Throw-at-boundary: sValidator runs in Hono middleware, outside the Effect pipeline.
	// TaggedErrors thrown here are caught by Hono's .onError → isTaggedError → mapped response.
	sValidator("json", AnalyticsPayload, (result) => {
		if (result.success) {
			return;
		}

		throw new ValidationError({
			global: [{ message: "Invalid analytics payload" }],
		});
	}),
	async (c) => {
		const user = c.get("user");
		const session = c.get("session");
		const payload = c.req.valid("json");

		if (payload.events.length === 0) {
			return c.json({ success: true });
		}

		await runEffect(
			Effect.gen(function* () {
				const analytics = yield* ClickHouseService;
				yield* analytics.insertEvents(payload.events, user.id, session.id);
			}),
		);

		return c.json({ success: true });
	},
);

export default app;
```

---

## apps/api/package.json

```json
{
	"name": "@chevrotain/api",
	"private": true,
	"type": "module",
	"sideEffects": false,
	"exports": {
		"./*": "./src/*.ts"
	},
	"scripts": {
		"dev": "tsx watch src/server.ts",
		"build": "rolldown -c",
		"start": "node dist/server.js"
	},
	"dependencies": {
		"@chevrotain/core": "workspace:*",
		"@chevrotain/zero": "workspace:*",
		"@hono/node-server": "1.19.11",
		"@hono/otel": "1.1.1",
		"@hono/prometheus": "1.0.2",
		"@hono/standard-validator": "0.2.2",
		"@opentelemetry/api": "1.9.0",
		"@opentelemetry/context-async-hooks": "2.6.0",
		"@opentelemetry/exporter-trace-otlp-http": "0.213.0",
		"@opentelemetry/instrumentation": "0.213.0",
		"@opentelemetry/instrumentation-pg": "0.65.0",
		"@opentelemetry/instrumentation-undici": "0.23.0",
		"@opentelemetry/resources": "2.6.0",
		"@opentelemetry/sdk-trace-base": "2.6.0",
		"@rocicorp/zero": "0.26.1",
		"arktype": "2.2.0",
		"autumn-js": "1.0.1",
		"effect": "4.0.0-beta.33",
		"hono": "4.12.8",
		"prom-client": "15.1.3"
	},
	"devDependencies": {
		"rolldown": "1.0.0-rc.9",
		"typescript": "5.9.3"
	}
}
```

---

## apps/api/rolldown.config.ts

```typescript
import { defineConfig } from "rolldown";

export default defineConfig({
	input: ["src/server.ts", "src/instrumentation.ts"],
	output: {
		dir: "dist",
		format: "esm",
		sourcemap: true,
	},
	platform: "node",
	external: [/^pg($|\/)/, /^@opentelemetry\/instrumentation(-pg)?$/],
});
```

---

## apps/web/src/clients/api.ts

```typescript
import { hc } from "hono/client";

import type { Routes } from "@chevrotain/api/index";

export const { api } = hc<Routes>(import.meta.env.VITE_BASE_URL!, {
	init: {
		credentials: "include",
	},
});
```

---

## apps/web/src/lib/analytics.ts

(See original file - 220 lines, too large to repeat here)
