# Migration Plan: Hono → @effect/platform HttpApi

## Current State

The API server (`apps/api`) uses Hono 4.12.8 as the HTTP framework. Effect v4 beta.33 is used for service layers and error handling, but the HTTP layer is Hono — effects are bridged via `runEffect()` / `runEffectFork()` in handlers.

Validation uses arktype via `@hono/standard-validator` in Hono middleware, outside the Effect pipeline. Errors are a mix of Effect `Data.TaggedError` (thrown at the Hono boundary) and manual `PublicError` (from Zero mutators). The web client uses Hono's typed `hc<Routes>` client.

## Target State

Replace Hono with Effect's built-in `HttpApi` system (`effect/unstable/httpapi/*`). Validation becomes declarative via `Schema` on endpoint definitions. Errors flow through the Effect error channel. The HTTP server is `@effect/platform-node`'s `NodeHttpServer`. The web client switches from Hono's `hc` to plain `fetch` (the only two calls are `api.analytics.$post` and `api.errors.$post` — no complex RPC).

## What Changes

| Layer           | Before                                     | After                                                          |
| --------------- | ------------------------------------------ | -------------------------------------------------------------- |
| HTTP framework  | `hono`                                     | `effect/unstable/http/*` + `@effect/platform-node`             |
| Routing         | `new Hono().get()/.post()/.route()`        | `HttpApiEndpoint` + `HttpApiGroup` + `HttpApi`                 |
| Validation      | arktype via `sValidator`                   | `Schema` on endpoint `.payload()`                              |
| Error types     | `Data.TaggedError` + manual status mapping | `Schema.TaggedError` + `HttpApiSchema.annotations({ status })` |
| Error handler   | Hono `.onError` + `errors/mapping.ts`      | Automatic — HttpApi maps tagged errors to status codes         |
| Auth middleware | Hono `createMiddleware`                    | `HttpApiMiddleware.Tag` providing `CurrentUser`                |
| CORS            | `hono/cors`                                | `effect/unstable/http/HttpMiddleware.cors`                     |
| Prometheus      | `@hono/prometheus`                         | `prom-client` directly on a raw router route                   |
| OTel            | `@hono/otel`                               | Keep existing `instrumentation.ts` (standalone OTLP)           |
| Server          | `@hono/node-server`                        | `@effect/platform-node` NodeHttpServer                         |
| Client          | `hono/client` `hc<Routes>`                 | Plain `fetch` with typed helpers                               |
| Runtime bridge  | `runEffect()` / `runEffectFork()`          | Gone — handlers ARE effects natively                           |

## What Does NOT Change

- `packages/core/src/drizzle/service.ts` — DatabaseService stays as-is
- `packages/core/src/analytics/service.ts` — ClickHouseService stays as-is
- `packages/core/src/billing/service.ts` — BillingService stays as-is
- `packages/core/src/email/service.ts` — EmailService stays as-is
- `apps/api/src/instrumentation.ts` — OTel setup stays as-is
- `packages/core/src/auth/index.ts` — better-auth config stays as-is
- `packages/zero/*` — Zero schema, mutators, queries untouched
- `apps/api/rolldown.config.ts` — build config stays as-is
- `packages/core/src/analytics/schema.ts` — arktype schemas stay for Zero/domain use; new `Schema` versions created for HttpApi endpoint definitions only

## Dependencies

### Add

```
@effect/platform-node  4.0.0-beta.33   # NodeHttpServer
```

### Remove

```
@hono/node-server       # Hono server adapter
@hono/otel              # Hono OTel middleware
@hono/prometheus         # Hono Prometheus middleware
@hono/standard-validator # Hono arktype validator
hono                    # Hono itself
```

### Keep

```
@opentelemetry/*        # OTel (standalone, not Hono-coupled)
@rocicorp/zero          # Zero sync (used in handlers)
arktype                 # Still used in core schemas, Zero, forms
autumn-js               # Billing (used in autumn handler)
effect                  # Already present
prom-client             # Prometheus (used directly, not via Hono)
```

## Route Inventory

| Route            | Method | Auth | Current File       | Migration Strategy                                         |
| ---------------- | ------ | ---- | ------------------ | ---------------------------------------------------------- |
| `/api/up`        | GET    | No   | index.ts           | HttpApiEndpoint, trivial                                   |
| `/api/metrics`   | GET    | No   | index.ts           | Raw `HttpRouter` route (prom-client)                       |
| `/api/auth/*`    | ALL    | No   | index.ts           | Raw `HttpRouter` route (passthrough to better-auth)        |
| `/api/query`     | POST   | Yes  | query.ts           | `handleRaw` (Zero needs raw `Request`)                     |
| `/api/mutate`    | POST   | Yes  | mutate.ts          | `handleRaw` (Zero needs raw `Request`)                     |
| `/api/analytics` | POST   | Yes  | analytics/index.ts | `HttpApiEndpoint.post` with Schema payload                 |
| `/api/errors`    | POST   | No   | errors/index.ts    | `HttpApiEndpoint.post` with Schema payload + rate limiting |
| `/api/autumn/*`  | ALL    | Yes  | autumn.ts          | `handleRaw` (autumn-js needs raw URL/method/body)          |

## File Plan

### New Files

#### `packages/core/src/errors.ts` — Rewrite errors as `Schema.TaggedError`

Currently uses `Data.TaggedError`. Rewrite to `Schema.TaggedError` with `HttpApiSchema.annotations({ status })` so HttpApi maps them automatically.

```typescript
import { Schema } from "effect";
import { HttpApiSchema } from "effect/unstable/httpapi";

// HTTP-mappable errors
export class NotFoundError extends Schema.TaggedError<NotFoundError>()(
	"NotFoundError",
	{ resource: Schema.optional(Schema.String), message: Schema.optional(Schema.String) },
	HttpApiSchema.annotations({ status: 404 }),
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
	"UnauthorizedError",
	{ message: Schema.optional(Schema.String) },
	HttpApiSchema.annotations({ status: 401 }),
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
	"ForbiddenError",
	{ message: Schema.optional(Schema.String) },
	HttpApiSchema.annotations({ status: 403 }),
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
	"ValidationError",
	{
		fields: Schema.optional(
			Schema.Array(
				Schema.Struct({
					path: Schema.Array(Schema.Union(Schema.String, Schema.Number)),
					message: Schema.String,
					code: Schema.optional(Schema.String),
				}),
			),
		),
		global: Schema.optional(
			Schema.Array(
				Schema.Struct({
					message: Schema.String,
					code: Schema.optional(Schema.String),
				}),
			),
		),
	},
	HttpApiSchema.annotations({ status: 400 }),
) {}

export class RateLimitError extends Schema.TaggedError<RateLimitError>()(
	"RateLimitError",
	{ message: Schema.optional(Schema.String) },
	HttpApiSchema.annotations({ status: 429 }),
) {}

// Infrastructure errors (all 500, don't leak internals)
export class DatabaseError extends Schema.TaggedError<DatabaseError>()(
	"DatabaseError",
	{ message: Schema.String, cause: Schema.Unknown },
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class ClickHouseError extends Schema.TaggedError<ClickHouseError>()(
	"ClickHouseError",
	{ message: Schema.String, cause: Schema.Unknown },
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class EmailError extends Schema.TaggedError<EmailError>()(
	"EmailError",
	{ message: Schema.String, cause: Schema.Unknown },
	HttpApiSchema.annotations({ status: 500 }),
) {}

export class BillingError extends Schema.TaggedError<BillingError>()(
	"BillingError",
	{ message: Schema.String, cause: Schema.Unknown },
	HttpApiSchema.annotations({ status: 500 }),
) {}
```

**Impact**: Every file that constructs these errors needs updating. `Data.TaggedError` constructors take `new ErrorClass({ field: value })`. `Schema.TaggedError` constructors take the same shape but the class definition syntax differs. The construction sites (`new ValidationError(...)`, `new ClickHouseError(...)`) stay the same — only the class definitions change.

**Verify**: `packages/core/src/analytics/service.ts`, `packages/core/src/billing/service.ts`, `packages/core/src/email/service.ts`, `apps/api/src/errors/index.ts` all construct these errors. Confirm constructor compatibility.

#### `apps/api/src/contract.ts` — API contract definition

Defines the full API structure. This is the single source of truth for all endpoints.

```typescript
import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApi } from "effect/unstable/httpapi";
import {
	NotFoundError,
	UnauthorizedError,
	ValidationError,
	RateLimitError,
	ClickHouseError,
} from "@chevrotain/core/errors";

// --- Schemas (Effect Schema equivalents of the arktype schemas) ---

const AnalyticsEventSchema = Schema.Struct({
	eventType: Schema.String.pipe(Schema.trimmed(), Schema.nonEmptyString()),
	url: Schema.String,
	referrer: Schema.String,
	properties: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const AnalyticsPayloadSchema = Schema.Struct({
	events: Schema.Array(AnalyticsEventSchema),
});

const ErrorReportSchema = Schema.Struct({
	errorType: Schema.String,
	message: Schema.String.pipe(Schema.trimmed(), Schema.nonEmptyString()),
	stackTrace: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
	properties: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
});

const ErrorPayloadSchema = Schema.Struct({
	errors: Schema.Array(ErrorReportSchema),
});

const SuccessResponse = Schema.Struct({ success: Schema.Literal(true) });

// --- Auth middleware context ---
// (Imported from the middleware module, defined below)

// --- Endpoint Groups ---

const healthGroup = HttpApiGroup.make("health").add(
	HttpApiEndpoint.get("healthCheck", "/up", { success: SuccessResponse }),
);

const analyticsGroup = HttpApiGroup.make("analytics").add(
	HttpApiEndpoint.post("ingestEvents", "/analytics", {
		payload: AnalyticsPayloadSchema,
		success: SuccessResponse,
		error: [ValidationError, ClickHouseError],
	}),
);

const errorsGroup = HttpApiGroup.make("errors").add(
	HttpApiEndpoint.post("reportErrors", "/errors", {
		payload: ErrorPayloadSchema,
		success: SuccessResponse,
		error: [ValidationError, RateLimitError, ClickHouseError],
	}),
);

// Zero and auth are raw endpoints (passthrough)
const zeroGroup = HttpApiGroup.make("zero")
	.add(HttpApiEndpoint.post("query", "/query"))
	.add(HttpApiEndpoint.post("mutate", "/mutate"));

// Auth passthrough — all methods
const authGroup = HttpApiGroup.make("auth")
	.add(HttpApiEndpoint.get("authGet", "/auth/*"))
	.add(HttpApiEndpoint.post("authPost", "/auth/*"));

// Autumn billing — all methods
const autumnGroup = HttpApiGroup.make("autumn")
	.add(HttpApiEndpoint.get("autumnGet", "/autumn/*"))
	.add(HttpApiEndpoint.post("autumnPost", "/autumn/*"));

// --- Full API ---

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, analyticsGroup, errorsGroup, zeroGroup, authGroup, autumnGroup)
	.prefix("/api")
	.addError(NotFoundError)
	.addError(UnauthorizedError) {}
```

**Note**: The exact `HttpApiEndpoint` constructor syntax needs verification against the v4 beta.33 API. The `.add()` method on `HttpApi` takes one group at a time or an array — need to check. The passthrough endpoints (`/auth/*`, `/autumn/*`) use `handleRaw` for implementation so their schema is minimal.

**Note 2**: The `zeroGroup` and `autumnGroup` endpoints need the auth middleware applied. The `authGroup` and `errorsGroup` do not. The `analyticsGroup` does. This is done via `.middleware()` on the group.

#### `apps/api/src/middleware/auth.ts` — Rewrite as HttpApiMiddleware

```typescript
import { Effect, ServiceMap, Schema } from "effect";
import { HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi";
import { HttpServerRequest } from "effect/unstable/http";
import { auth } from "@chevrotain/core/auth/index";
import { UnauthorizedError } from "@chevrotain/core/errors";

type Session = typeof auth.$Infer.Session;

// Context tag that handlers receive after auth
export class CurrentUser extends ServiceMap.Service<
	CurrentUser,
	{
		readonly user: Session["user"];
		readonly session: Session["session"];
	}
>()("CurrentUser") {}

// Middleware tag
export class AuthMiddleware extends HttpApiMiddleware.Tag<AuthMiddleware>()("AuthMiddleware", {
	provides: CurrentUser,
	failure: UnauthorizedError,
}) {}

// Implementation layer
export const AuthMiddlewareLive = Layer.effect(AuthMiddleware)(
	Effect.gen(function* () {
		return AuthMiddleware.of(
			Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const session = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers: request.headers }),
					catch: () => new UnauthorizedError({ message: "Auth check failed" }),
				});
				if (!session) {
					return yield* new UnauthorizedError({ message: "Unauthorized" });
				}
				return { user: session.user, session: session.session };
			}),
		);
	}),
);
```

**Note**: The `HttpServerRequest` in v4 beta.33 is at `effect/unstable/http/HttpServerRequest`. Need to verify the exact import path and how to read request headers from it.

#### `apps/api/src/handlers/analytics.ts` — Analytics handler

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { CurrentUser } from "@chevrotain/api/middleware/auth";

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	Effect.gen(function* () {
		return handlers.handle("ingestEvents", ({ payload }) =>
			Effect.gen(function* () {
				if (payload.events.length === 0) {
					return { success: true as const };
				}
				const { user, session } = yield* CurrentUser;
				const analytics = yield* ClickHouseService;
				yield* analytics.insertEvents(payload.events, user.id, session.id);
				return { success: true as const };
			}),
		);
	}),
);
```

**Key difference**: No `runEffect()`. The handler IS an Effect. Validation already happened (HttpApi decoded the payload from the Schema). Services are yielded directly.

#### `apps/api/src/handlers/errors.ts` — Error reporting handler

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { HttpServerRequest } from "effect/unstable/http";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitError } from "@chevrotain/core/errors";

// Rate limiting state (same as current)
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

const cleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of requestCounts) {
		if (now >= entry.resetAt) requestCounts.delete(ip);
	}
}, RATE_LIMIT_WINDOW_MS);

export function stopRateLimitCleanup(): void {
	clearInterval(cleanupInterval);
}

export const ErrorsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "errors", (handlers) =>
	handlers.handle("reportErrors", ({ payload }) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const ip =
				request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
				request.headers["x-real-ip"] ??
				"unknown";

			if (isRateLimited(ip)) {
				return yield* new RateLimitError({ message: "Too many error reports" });
			}

			if (payload.errors.length === 0) {
				return { success: true as const };
			}

			const userAgent = request.headers["user-agent"] ?? "";
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

			return { success: true as const };
		}),
	),
);
```

**Note**: Need to check how `HttpServerRequest` exposes headers in v4. It might be `request.headers.get("x-forwarded-for")` (Web API Headers) rather than object property access.

#### `apps/api/src/handlers/zero.ts` — Zero query/mutate handlers

These need raw request access because `@rocicorp/zero`'s `handleQueryRequest` and `handleMutateRequest` take a raw `Request` object.

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { mustGetQuery, mustGetMutator } from "@rocicorp/zero";
import { handleQueryRequest, handleMutateRequest } from "@rocicorp/zero/server";
import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { db } from "@chevrotain/core/drizzle/index";
import { mutators } from "@chevrotain/zero/mutators";
import { queries } from "@chevrotain/zero/queries";
import { schema } from "@chevrotain/zero/schema";

const dbProvider = zeroDrizzle(schema, db);

export const ZeroHandlerLive = HttpApiBuilder.group(ChevrotainApi, "zero", (handlers) =>
	handlers
		.handleRaw("query", () =>
			Effect.gen(function* () {
				const { user } = yield* CurrentUser;
				const request = yield* HttpServerRequest.HttpServerRequest;
				const result = await handleQueryRequest(
					(name, args) => {
						const query = mustGetQuery(queries, name);
						return query.fn({ args, ctx: { userId: user.id } });
					},
					schema,
					request.source, // raw Request object
				);
				return HttpServerResponse.json(result);
			}),
		)
		.handleRaw("mutate", () =>
			Effect.gen(function* () {
				const { user } = yield* CurrentUser;
				const request = yield* HttpServerRequest.HttpServerRequest;
				const ctx = { userId: user.id };
				const result = await handleMutateRequest(
					dbProvider,
					async (transact) =>
						await transact(async (tx, name, args) => {
							const mutator = mustGetMutator(mutators, name);
							return await mutator.fn({ tx, ctx, args });
						}),
					request.source, // raw Request object
				);
				return HttpServerResponse.json(result);
			}),
		),
);
```

**Note**: `request.source` is the raw underlying `Request` — need to verify this property name in v4 beta.33. Might be `request.raw` or `request.source`.

**Note 2**: These handlers use `await` inside `Effect.gen` which works because generators support it, but it bypasses Effect's error tracking for the Zero calls. This is intentional — Zero manages its own error handling and we just forward the result.

#### `apps/api/src/handlers/auth.ts` — Better-auth passthrough

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { auth } from "@chevrotain/core/auth/index";

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) => {
	const passthrough = () =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const response = yield* Effect.promise(() => auth.handler(request.source));
			return HttpServerResponse.fromWeb(response);
		});

	return handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough);
});
```

**Note**: Need to verify `HttpServerResponse.fromWeb()` exists in v4. Alternative: construct from the Response manually.

#### `apps/api/src/handlers/autumn.ts` — Billing passthrough

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { autumnHandler } from "autumn-js/backend";
import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";

export const AutumnHandlerLive = HttpApiBuilder.group(ChevrotainApi, "autumn", (handlers) => {
	const passthrough = () =>
		Effect.gen(function* () {
			const { user } = yield* CurrentUser;
			const request = yield* HttpServerRequest.HttpServerRequest;
			const body =
				request.method !== "GET"
					? yield* Effect.tryPromise({ try: () => request.json, catch: () => null })
					: null;

			const { statusCode, response } = yield* Effect.promise(() =>
				autumnHandler({
					customerId: user.id,
					customerData: { name: user.name, email: user.email },
					request: { url: request.url, method: request.method, body },
				}),
			);

			return HttpServerResponse.json(response, { status: statusCode });
		});

	return handlers.handleRaw("autumnGet", passthrough).handleRaw("autumnPost", passthrough);
});
```

#### `apps/api/src/handlers/health.ts` — Health check

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { ChevrotainApi } from "@chevrotain/api/contract";

export const HealthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "health", (handlers) =>
	handlers.handle("healthCheck", () => Effect.succeed({ success: true as const })),
);
```

#### `apps/api/src/index.ts` — Rewrite: compose API + serve

```typescript
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { HttpMiddleware, HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { NodeHttpServer } from "@effect/platform-node";
import { register } from "prom-client";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { AnalyticsHandlerLive } from "@chevrotain/api/handlers/analytics";
import { AuthHandlerLive } from "@chevrotain/api/handlers/auth";
import { AutumnHandlerLive } from "@chevrotain/api/handlers/autumn";
import { ErrorsHandlerLive } from "@chevrotain/api/handlers/errors";
import { HealthHandlerLive } from "@chevrotain/api/handlers/health";
import { ZeroHandlerLive } from "@chevrotain/api/handlers/zero";
import { AuthMiddlewareLive } from "@chevrotain/api/middleware/auth";
import { AppLayer } from "@chevrotain/api/runtime";

const baseUrl = process.env.BASE_URL!;

// Prometheus metrics route (outside HttpApi — uses raw router)
const metricsRoute = HttpRouter.empty.pipe(
	HttpRouter.get(
		"/api/metrics",
		Effect.sync(() => {
			const metrics = register.metrics();
			return HttpServerResponse.text(metrics, {
				headers: { "Content-Type": register.contentType },
			});
		}),
	),
);

// CORS middleware
const corsMiddleware = HttpMiddleware.cors({
	allowedOrigins: [baseUrl],
	allowedHeaders: ["Content-Type", "Authorization"],
	allowedMethods: ["GET", "POST", "OPTIONS"],
	exposedHeaders: ["Content-Length"],
	credentials: true,
	maxAge: 600,
});

// Compose the API layer
const ApiLive = Layer.mergeAll(
	HealthHandlerLive,
	AnalyticsHandlerLive,
	ErrorsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	AutumnHandlerLive,
);

// Wire everything together
const ServerLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(ApiLive),
	Layer.provide(AuthMiddlewareLive),
	// Add CORS, OTel, metrics route
	// Provide services
	Layer.provide(AppLayer),
	Layer.provide(HttpServer.layerServices),
	Layer.provide(NodeHttpServer.layer(/* server options */)),
);
```

**Note**: The exact wiring pattern (how to compose CORS, raw routes, and the HttpApi layer onto a single server) needs experimentation. The research shows that `HttpApiBuilder.layer(api)` produces a `Layer<never, never, HttpRouter | ...services>` which you then provide to `HttpServer.serve()`.

#### `apps/api/src/server.ts` — Rewrite entry point

```typescript
import { Layer, ManagedRuntime } from "effect";
import { NodeHttpServer } from "@effect/platform-node";
import { stopRateLimitCleanup } from "@chevrotain/api/handlers/errors";
import { shutdownTelemetry } from "@chevrotain/api/instrumentation";
import { ServerLive } from "@chevrotain/api/index";

const port = Number(process.env.PORT!);

// Create and run the server
const runtime = ManagedRuntime.make(ServerLive);
// The server starts automatically when the runtime is created
// (NodeHttpServer.layer starts listening)

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	stopRateLimitCleanup();
	await runtime.dispose(); // closes server + DB pool + ClickHouse client + etc.
	await shutdownTelemetry();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

#### `apps/api/src/runtime.ts` — Simplify

`runEffect()` and `runEffectFork()` are no longer needed for HttpApi handlers (they ARE effects). Keep `AppLayer` for service composition. Keep `runEffectFork` only if needed for fire-and-forget from non-Effect contexts (e.g. error logging in the future).

```typescript
import { Layer } from "effect";
import { ClickHouseServiceLive } from "@chevrotain/core/analytics/service";
import { BillingServiceLive } from "@chevrotain/core/billing/service";
import { DatabaseServiceLive } from "@chevrotain/core/drizzle/service";
import { EmailServiceLive } from "@chevrotain/core/email/service";

export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	BillingServiceLive,
	EmailServiceLive,
);
```

### Modified Files

#### `apps/web/src/clients/api.ts` — Replace Hono client with fetch

Currently:

```typescript
import { hc } from "hono/client";
import type { Routes } from "@chevrotain/api/index";
export const { api } = hc<Routes>(import.meta.env.VITE_BASE_URL!, {
	init: { credentials: "include" },
});
```

After:

```typescript
const baseUrl = import.meta.env.VITE_BASE_URL;

async function postJson<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(`${baseUrl}/api${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	return res.json();
}

export const api = {
	analytics: {
		$post: (opts: { json: { events: unknown[] } }) => postJson("/analytics", opts.json),
	},
	errors: {
		$post: (opts: { json: { errors: unknown[] } }) => postJson("/errors", opts.json),
	},
};
```

The web app only makes 2 API calls (both POSTs with JSON). No need for a typed client library.

#### `apps/web/src/lib/analytics.ts` — No changes needed

It calls `api.analytics.$post({ json: { events } })` and `api.errors.$post({ json: { errors } })`. As long as the `api` client export keeps the same shape (which it does above), this file doesn't change.

### Deleted Files

| File                              | Reason                                                           |
| --------------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/errors/mapping.ts`  | Status code mapping is automatic via `HttpApiSchema.annotations` |
| `apps/api/src/query.ts`           | Moved to `handlers/zero.ts`                                      |
| `apps/api/src/mutate.ts`          | Moved to `handlers/zero.ts`                                      |
| `apps/api/src/autumn.ts`          | Moved to `handlers/autumn.ts`                                    |
| `apps/api/src/analytics/index.ts` | Moved to `handlers/analytics.ts`                                 |
| `apps/api/src/errors/index.ts`    | Moved to `handlers/errors.ts`                                    |

## Open Questions / Risks

### 1. `HttpServerRequest` header access

Need to verify how `HttpServerRequest` exposes headers in v4 beta.33. Possibilities:

- `request.headers` as a `Headers` object (Web API) → use `.get("x-forwarded-for")`
- `request.headers` as a plain object → use property access
- Need `HttpServerRequest.schemaHeaders(Schema)` for typed header extraction

### 2. Raw `Request` access for Zero / better-auth

Zero's `handleQueryRequest` and `handleMutateRequest` need a raw `Request` object. Need to verify:

- Property name: `request.source`? `request.raw`? Something else?
- Whether `handleRaw` provides access to the underlying Request

### 3. `HttpServerResponse.fromWeb()` for auth passthrough

better-auth's `auth.handler(request)` returns a Web `Response`. Need to convert back to Effect's `HttpServerResponse`. Verify `HttpServerResponse.fromWeb()` exists, or build manually.

### 4. Prometheus metrics integration

`@hono/prometheus` auto-instruments all routes. With HttpApi, we lose that. Options:

- Keep `prom-client` and manually collect metrics (explicit counters/histograms in a middleware layer)
- Add a raw `HttpRouter` route for `/api/metrics` that serves `register.metrics()`
- Defer to OTel-based metrics instead of Prometheus

### 5. `PublicError` from Zero mutators

Zero mutators throw `PublicError` (not Effect tagged errors). After the migration, these still need to be caught somewhere. Options:

- The `handleRaw` handlers wrap Zero calls in try/catch and convert `PublicError` to an `HttpServerResponse` directly
- Or add a middleware/error handler that catches `PublicError` and converts it

### 6. Forward-compatibility with Effect v4 final

As noted in the review: `ServiceMap.Service` will become `Effect.Service`, `Layer.effect` will re-separate from `Layer.scoped`, etc. This migration adds more surface area (HttpApi imports from `effect/unstable/*`) that will also change. The `unstable` prefix is a clear signal these APIs are expected to change.

### 7. `arktype` → `Schema` duplication

The analytics payload schemas currently use `arktype` (`packages/core/src/analytics/schema.ts`). HttpApi endpoint definitions need `Schema`. This creates parallel definitions for the same shape. Options:

- Accept the duplication (arktype schemas stay for domain use, Schema versions for HTTP contract)
- Remove arktype schemas and use Schema everywhere (larger change, affects Zero/forms)
- Use `Schema.standardSchemaV1` to bridge if available

## Implementation Order

1. **Add `@effect/platform-node` dep, install, verify**
2. **Rewrite `packages/core/src/errors.ts`** — `Data.TaggedError` → `Schema.TaggedError`
3. **Verify all error construction sites still compile** — services, handlers
4. **Create `apps/api/src/contract.ts`** — API contract
5. **Create `apps/api/src/middleware/auth.ts`** — Auth middleware
6. **Create `apps/api/src/handlers/*.ts`** — All 6 handler groups
7. **Rewrite `apps/api/src/index.ts`** — Compose and serve
8. **Rewrite `apps/api/src/server.ts`** — Entry point
9. **Simplify `apps/api/src/runtime.ts`** — Remove runEffect/runEffectFork
10. **Rewrite `apps/web/src/clients/api.ts`** — Replace Hono client
11. **Update `apps/api/package.json`** — Add/remove deps
12. **Delete old files** — mapping.ts, query.ts, mutate.ts, autumn.ts, etc.
13. **Run `vp install`**
14. **Run `vp lint --type-aware --type-check`** — fix all type errors
15. **Run `vp test`** — fix all test failures
16. **Run `treefmt`** — format
