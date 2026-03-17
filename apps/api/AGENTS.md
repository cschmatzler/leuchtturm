# @chevrotain/api - Effect-TS API Server

## Overview

Effect-TS HTTP API with Node.js. All routes under `/api`. Contract-first design with `HttpApi`/`HttpApiBuilder`. Auth via better-auth. Services injected via Effect Layers.

## Structure

```
src/
├── index.ts              # Layer composition, CORS, HTTP server assembly
├── server.ts             # ManagedRuntime entry point, graceful shutdown
├── contract.ts           # HttpApi endpoint definitions + payload schemas
├── runtime.ts            # AppLayer — service layer composition
├── instrumentation.ts    # OpenTelemetry metrics + tracing setup
├── handlers/
│   ├── health.ts         # GET /api/up
│   ├── analytics.ts      # POST /api/analytics (auth required)
│   ├── errors.ts         # POST /api/errors (rate-limited, no auth)
│   ├── auth.ts           # /api/auth/* passthrough to better-auth
│   ├── autumn.ts         # /api/autumn/* passthrough to autumn-js
│   ├── zero.ts           # POST /api/query + /api/mutate (Zero protocol)
│   └── analytics.test.ts # Analytics handler tests
└── middleware/
    └── auth.ts           # AuthMiddleware — provides CurrentUser service
```

## Where to Look

| Task                     | Location                                   |
| ------------------------ | ------------------------------------------ |
| Add endpoint             | `contract.ts` + new handler in `handlers/` |
| Modify auth middleware   | `middleware/auth.ts`                       |
| Add service dependency   | `runtime.ts`                               |
| Handle billing webhooks  | `handlers/autumn.ts`                       |
| Add analytics tracking   | `handlers/analytics.ts`                    |
| Add OpenTelemetry metric | `instrumentation.ts`                       |

## Conventions

### Contract-First API

Endpoints are declared in `contract.ts` using `HttpApiGroup` and `HttpApiEndpoint`. Payload schemas, success types, and error types are all defined here:

```typescript
import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware } from "@chevrotain/api/middleware/auth";

const analyticsGroup = HttpApiGroup.make("analytics")
	.add(
		HttpApiEndpoint.post("ingestEvents", "/analytics", {
			payload: AnalyticsPayload,
			success: SuccessResponse,
			error: [ValidationError, ClickHouseError],
		}),
	)
	.middleware(AuthMiddleware);

export class ChevrotainApi extends HttpApi.make("chevrotain")
	.add(healthGroup, analyticsGroup, errorsGroup, zeroGroup, authGroup, autumnGroup)
	.prefix("/api") {}
```

### Handler Pattern

Handlers implement the contract using `HttpApiBuilder.group`. Each handler is a Layer:

```typescript
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";
import { ClickHouseService } from "@chevrotain/core/analytics/service";

export const AnalyticsHandlerLive = HttpApiBuilder.group(ChevrotainApi, "analytics", (handlers) =>
	handlers.handle("ingestEvents", ({ payload }) =>
		Effect.gen(function* () {
			if (payload.events.length === 0) {
				return { success: true as const };
			}
			const { user, session } = yield* CurrentUser;
			const analytics = yield* ClickHouseService;
			yield* analytics.insertEvents([...payload.events], user.id, session.id);
			return { success: true as const };
		}),
	),
);
```

### Raw Passthrough (better-auth, autumn-js)

For endpoints that delegate to external libraries, use `handleRaw`:

```typescript
const passthrough = () =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = request.source as globalThis.Request;
		const response = yield* Effect.promise(() => auth.handler(rawRequest));
		return HttpServerResponse.fromWeb(response);
	});

export const AuthHandlerLive = HttpApiBuilder.group(ChevrotainApi, "auth", (handlers) =>
	handlers.handleRaw("authGet", passthrough).handleRaw("authPost", passthrough),
);
```

### Auth Middleware

`AuthMiddleware` provides `CurrentUser` service to downstream handlers:

```typescript
import { ServiceMap } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

export interface CurrentUserShape {
	readonly user: Session["user"];
	readonly session: Session["session"];
}

export class CurrentUser extends ServiceMap.Service<CurrentUser, CurrentUserShape>()(
	"CurrentUser",
) {}

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: CurrentUser }
>()("AuthMiddleware", { error: UnauthorizedError }) {}
```

Access in handlers:

```typescript
const { user, session } = yield * CurrentUser;
```

### Service Layer

All services are composed in `runtime.ts`:

```typescript
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	BillingServiceLive,
	EmailServiceLive,
);
```

### Layer Composition (index.ts)

```typescript
const HandlersLive = Layer.mergeAll(
	HealthHandlerLive,
	AnalyticsHandlerLive,
	ErrorsHandlerLive,
	ZeroHandlerLive,
	AuthHandlerLive,
	AutumnHandlerLive,
);

const HandlersWithDeps = HandlersLive.pipe(Layer.provide(AppLayer));

const ApiLive = HttpApiBuilder.layer(ChevrotainApi).pipe(
	Layer.provide(HandlersWithDeps),
	Layer.provide(AuthMiddlewareLive),
);

const httpApp = Effect.flatten(HttpRouter.toHttpEffect(ApiLive));
export const ServerLive = HttpServer.serve(httpApp, CorsMiddleware);
```

### Server Lifecycle

`server.ts` uses `ManagedRuntime` for automatic resource acquisition/release:

```typescript
const runtime = ManagedRuntime.make(AppLive);
await runtime.runPromise(Effect.void);

async function shutdown() {
	stopRateLimitCleanup();
	await runtime.dispose();
	await shutdownTelemetry();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

### Error Handling

All errors use `Schema.TaggedErrorClass` with `httpApiStatus` annotations (defined in `@chevrotain/core/errors`):

```typescript
// In handlers — return typed errors:
if (isRateLimited(ip)) {
	return yield * new RateLimitError({ message: "Too many error reports" });
}

// In contract — declare error types per endpoint:
HttpApiEndpoint.post("reportErrors", "/errors", {
	error: [ValidationError, RateLimitError, ClickHouseError],
});
```

### Wrapping Promises

Use `Effect.promise` for infallible async ops, `Effect.tryPromise` for fallible ones:

```typescript
// Infallible (will defect on rejection)
const result = yield* Effect.promise(() => handleQueryRequest(...));

// Fallible (maps rejection to typed error)
const session = yield* Effect.tryPromise({
	try: () => auth.api.getSession({ headers: rawRequest.headers }),
	catch: () => new UnauthorizedError({ message: "Auth check failed" }),
});
```

### Option Handling

Use `Option` combinators for header extraction:

```typescript
const forwarded = Headers.get(request.headers, "x-forwarded-for").pipe(
	Option.map((v) => v.split(",")[0]?.trim() ?? "unknown"),
);
const realIp = Headers.get(request.headers, "x-real-ip");
const ip = Option.getOrElse(forwarded, () => Option.getOrElse(realIp, () => "unknown"));
```

## API Endpoints Reference

| Method | Path             | Auth | Description                |
| ------ | ---------------- | ---- | -------------------------- |
| GET    | `/api/up`        | No   | Health check               |
| POST   | `/api/analytics` | Yes  | Analytics event ingestion  |
| POST   | `/api/errors`    | No   | Client error reporting     |
| POST   | `/api/query`     | Yes  | Zero query endpoint        |
| POST   | `/api/mutate`    | Yes  | Zero mutation endpoint     |
| ALL    | `/api/auth/*`    | No   | Better-auth handlers       |
| ALL    | `/api/autumn/*`  | Yes  | Autumn billing passthrough |

## Testing

Mock services via `Layer.succeed()`:

```typescript
import { describe, it, expect, vi } from "vite-plus/test";
import { Effect, Layer } from "effect";

const MockClickHouseServiceLive = Layer.succeed(ClickHouseService, {
	insertEvents: (events, userId, sessionId) => {
		mockInsertEvents(events, userId, sessionId);
		return Effect.void;
	},
	insertErrors: (errors) => {
		mockInsertErrors(errors);
		return Effect.void;
	},
});

const program = Effect.gen(function* () {
	const service = yield* ClickHouseService;
	yield* service.insertEvents(events, "user-1", "session-1");
});

await Effect.runPromise(program.pipe(Effect.provide(MockClickHouseServiceLive)));
```

## OpenTelemetry

Instrumentation in `instrumentation.ts`:

- OTLP exporters for traces and metrics
- Auto-instrumentation: PostgreSQL, Undici (HTTP client)
- Service name: `chevrotain-api`

Metrics:

- `http_requests_total` — Request counter
- `http_request_duration_ms` — Latency histogram (0-1000ms, 50ms buckets)
- `http_errors_total` — Error counter

## Environment Variables

| Variable             | Purpose                     |
| -------------------- | --------------------------- |
| `BASE_URL`           | CORS origin                 |
| `PORT`               | Server port (default: 3005) |
| `DATABASE_URL`       | PostgreSQL connection       |
| `CLICKHOUSE_URL`     | Analytics database          |
| `RESEND_API_KEY`     | Email service               |
| `AUTUMN_SECRET_KEY`  | Billing service             |
| `BETTER_AUTH_SECRET` | Auth signing key            |

## Anti-Patterns

| Never                                | Instead                                        |
| ------------------------------------ | ---------------------------------------------- |
| `throw` inside `Effect.gen`          | `yield* new TaggedError(...)` or `Effect.fail` |
| `Effect.runPromise` inside a handler | Compose effects, run once at boundary          |
| `yield` without `*`                  | Always `yield*` to execute an Effect           |
| `try/catch` for Effect errors        | Use `Effect.catchTag` or error channel         |
| Manual cleanup in finally blocks     | Use `Effect.acquireRelease`                    |
| Scattered `Effect.runPromise` calls  | Compose into layers, run via `ManagedRuntime`  |
| `as any` or `@ts-ignore`             | Fix the types properly                         |
