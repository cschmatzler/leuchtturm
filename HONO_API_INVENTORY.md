# Complete Hono API Inventory - Chevrotain Project

**Project Location:** `/home/cschmatzler/Projects/Personal/0`

**Generated:** 2026-03-17

---

## Executive Summary

The Chevrotain API uses Hono 4.12.8 with Node.js 25, OpenTelemetry instrumentation, and Effect-based error handling. The API is structured as a monolithic Hono app with:

- **7 route groups** mounted at `/api/*`
- **Zero-specific endpoints** for @rocicorp/zero sync protocol
- **Auth-required endpoints** using better-auth
- **Effect runtime** for managed resource handling
- **OpenTelemetry instrumentation** for tracing (OTLP exporter)
- **Prometheus metrics** for monitoring
- **Error handling** with tagged errors and rate limiting

---

## Complete API Structure

### Root Router (`/api`)

All routes prefixed with `/api` via `.basePath("/api")`.

| Route             | Type   | Handler     | Description                             |
| ----------------- | ------ | ----------- | --------------------------------------- |
| `GET /metrics`    | Public | Prometheus  | Prometheus metrics endpoint             |
| `GET /up`         | Public | Basic JSON  | Health check, returns `{success: true}` |
| `ALL /auth/*`     | Public | better-auth | Authentication handler                  |
| `POST /query`     | Auth   | Zero sync   | Read operations (sync protocol)         |
| `POST /mutate`    | Auth   | Zero sync   | Write operations (sync protocol)        |
| `POST /analytics` | Auth   | Custom      | Event tracking (ClickHouse)             |
| `POST /errors`    | Public | Custom      | Client error reporting                  |
| `ALL /autumn/*`   | Auth   | autumn-js   | Billing webhooks                        |

---

## File-by-File Inventory

### 1. **apps/api/src/index.ts** (175 lines)

**Main Hono application and route composition.**

**Key Details:**

- Creates Hono app with `.basePath("/api")`
- Applies middleware: httpInstrumentationMiddleware, CORS, registerMetrics
- Mounts all sub-routes via `.route()`
- Global error handler: `.onError()` and `.notFound()`
- Error handling:
  - TaggedErrors (Effect-based): Maps to status codes, logs to ClickHouse, records OpenTelemetry spans
  - PublicError (legacy): Returns structured error response
  - Unhandled defects: Returns 500 with "Internal server error"

**Environment Variables:**

- `BASE_URL` - CORS origin (required)

**Dependencies:**

- `hono` v4.12.8
- `@hono/otel` - HTTP instrumentation
- `@hono/prometheus` - Metrics
- `@opentelemetry/api` - Trace context
- `prom-client` - Prometheus client

**Error Response Format:**

```typescript
{
  success: false,
  error: {
    global: [{ code?: string; message: string }],
    fields: [{ path: string[]; message: string }]
  }
}
```

---

### 2. **apps/api/src/server.ts** (24 lines)

**Server entry point - HTTP listener.**

**Key Details:**

- Imports app from `index.ts`
- Uses `@hono/node-server` to start HTTP server
- Port from `process.env.PORT`
- Graceful shutdown handlers: SIGINT, SIGTERM
- Cleanup sequence:
  1. Close HTTP server
  2. Stop rate limit cleanup timer
  3. Shutdown runtime (DB, ClickHouse, etc.)
  4. Shutdown telemetry

**Build Output:**

- Rolldown builds to `dist/server.js` (ESM)
- Start command: `node dist/server.js`

---

### 3. **apps/api/src/query.ts** (24 lines)

**Zero sync read endpoint - `/api/query POST`**

**Key Details:**

- Mounts on `new Hono<{ Variables: AuthVariables }>()`
- Requires auth middleware
- Handles @rocicorp/zero query protocol
- Uses `handleQueryRequest()` from @rocicorp/zero/server
- Provides `queries` from `@chevrotain/zero/queries` package
- Provides `schema` from `@chevrotain/zero/schema` package
- Context: `{ userId: user.id }`

**Handler Signature:**

```typescript
app.post("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const result = await handleQueryRequest(
    (name, args) => {
      const query = mustGetQuery(queries, name);
      return query.fn({ args, ctx: { userId: user.id } });
    },
    schema,
    c.req.raw
  );
  return c.json(result);
}
```

---

### 4. **apps/api/src/mutate.ts** (31 lines)

**Zero sync write endpoint - `/api/mutate POST`**

**Key Details:**

- Mounts on `new Hono<{ Variables: AuthVariables }>()`
- Requires auth middleware
- Handles @rocicorp/zero mutation protocol
- Uses `handleMutateRequest()` from @rocicorp/zero/server
- Uses `zeroDrizzle()` adapter for Drizzle ORM integration
- Provides `mutators` from `@chevrotain/zero/mutators` package
- Provides `schema` from `@chevrotain/zero/schema` package
- Provides `db` from `@chevrotain/core/drizzle/index`
- Context: `{ userId: user.id }`

**Handler Signature:**

```typescript
const dbProvider = zeroDrizzle(schema, db);

app.post("/", authMiddleware, async (c) => {
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
    c.req.raw
  );
  return c.json(result);
}
```

---

### 5. **apps/api/src/autumn.ts** (28 lines)

**Billing webhooks - `/api/autumn/* ALL`**

**Key Details:**

- Mounts on `new Hono<{ Variables: AuthVariables }>()`
- Requires auth middleware
- Handles all HTTP methods (`.all("/*")`)
- Uses `autumnHandler()` from `autumn-js/backend`
- Passes customer ID (user.id), name, and email
- Returns status code and response body from autumn

**Handler Signature:**

```typescript
app.all("/*", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = c.req.method !== "GET" ? await c.req.json() : null;
  const { statusCode, response } = await autumnHandler({
    customerId: user.id,
    customerData: { name: user.name, email: user.email },
    request: { url: c.req.url, method: c.req.method, body },
  });
  return c.json(response, statusCode as ContentfulStatusCode);
}
```

---

### 6. **apps/api/src/middleware/auth.ts** (24 lines)

**Authentication middleware.**

**Key Details:**

- Creates middleware via `createMiddleware()` from hono/factory
- Uses `auth.api.getSession()` from `@chevrotain/core/auth/index` (better-auth)
- Gets session from request headers
- Sets context variables:
  - `user` - User object from session
  - `session` - Session object
- Throws `PublicError({ status: 401, global: [{ message: "Unauthorized" }] })` if no session

**Type Definition:**

```typescript
type Session = typeof auth.$Infer.Session;

export type AuthVariables = {
	user: Session["user"];
	session: Session["session"];
};
```

---

### 7. **apps/api/src/instrumentation.ts** (30 lines)

**OpenTelemetry setup.**

**Key Details:**

- Initializes OTLP trace exporter (HTTP)
- Uses AsyncLocalStorageContextManager for context propagation
- Registers instrumentations: PgInstrumentation, UndiciInstrumentation
- Service name: `"chevrotain-api"`
- Batch span processor
- Exports `shutdownTelemetry()` function

**Configuration:**

```typescript
const resource = resourceFromAttributes({
	"service.name": "chevrotain-api",
});

const tracerProvider = new BasicTracerProvider({
	resource,
	spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
```

**Instrumentation Packages:**

- `@opentelemetry/instrumentation-pg` - PostgreSQL traces
- `@opentelemetry/instrumentation-undici` - HTTP client traces (fetch)

---

### 8. **apps/api/src/runtime.ts** (65 lines)

**Effect-based runtime management.**

**Key Details:**

- Composes service layers into AppLayer
- Creates ManagedRuntime for app lifetime
- Exports two functions for running effects:
  - `runEffect<A, E>()` - Inside Hono handlers, returns Promise<A>
  - `runEffectFork<E>()` - Fire-and-forget from non-Effect contexts
- Service layers:
  - DatabaseServiceLive (Drizzle)
  - ClickHouseServiceLive (Analytics)
  - BillingServiceLive (autumn-js)
  - EmailServiceLive (React Email)

**Error Handling in runEffect:**

1. Checks for interrupts (request cancelled) → throws "Effect interrupted"
2. Checks for defects (bugs) → re-throws as regular Error
3. Checks for typed failures (TaggedErrors) → re-throws for Hono.onError
4. Re-throws Exit for unhandled cases

**Shutdown:**

```typescript
export const shutdownRuntime = () => AppRuntime.dispose();
```

---

### 9. **apps/api/src/errors/index.ts** (95 lines)

**Client error reporting endpoint - `/api/errors POST`**

**Key Details:**

- Mounts on plain `new Hono()` (no auth required)
- Validates payload with `sValidator` from @hono/standard-validator
- Rate limiting: 30 requests per 60 seconds per IP
- IP extraction: header priority `x-forwarded-for` → `x-real-ip` → "unknown"
- Cleanup interval: Clears stale entries every 60 seconds

**Handler Signature:**

```typescript
app.post(
  "/",
  sValidator("json", ErrorPayload, (result) => {
    if (!result.success) {
      throw new ValidationError({
        global: [{ message: "Invalid error payload" }],
      });
    }
  }),
  async (c) => {
    // Check rate limit, insert to ClickHouse
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
               c.req.header("x-real-ip") ??
               "unknown";

    if (isRateLimited(ip)) {
      throw new RateLimitError({ message: "Too many error reports" });
    }

    // Insert errors using Effect runtime
    await runEffect(Effect.gen(function* () {
      const analytics = yield* ClickHouseService;
      yield* analytics.insertErrors(...);
    }));

    return c.json({ success: true });
  }
);
```

**Rate Limiting:**

```typescript
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
```

---

### 10. **apps/api/src/errors/mapping.ts** (87 lines)

**Error type mapping and status code conversion.**

**Key Details:**

- Defines exhaustive error type union: TaggedApiError
- Maps errors to HTTP status codes
- Converts TaggedError to response structure

**Status Code Mapping:**
| Error Type | Status Code |
| ----------------- | ----------- |
| NotFoundError | 404 |
| UnauthorizedError | 401 |
| ForbiddenError | 403 |
| ValidationError | 400 |
| RateLimitError | 429 |
| DatabaseError | 500 |
| ClickHouseError | 500 |
| EmailError | 500 |
| BillingError | 500 |

**Functions:**

```typescript
isTaggedError(error: unknown): error is TaggedApiError
taggedErrorToStatus(error: TaggedApiError): ContentfulStatusCode
taggedErrorToResponse(error: TaggedApiError): { global: [...], fields: [...] }
```

---

### 11. **apps/api/src/analytics/index.ts** (44 lines)

**Analytics event tracking endpoint - `/api/analytics POST`**

**Key Details:**

- Mounts on `new Hono<{ Variables: AuthVariables }>()`
- Requires auth middleware
- Validates payload with `sValidator` from @hono/standard-validator
- Inserts events to ClickHouse using Effect runtime
- Passes user ID and session ID to ClickHouse

**Handler Signature:**

```typescript
app.post(
	"/",
	authMiddleware,
	sValidator("json", AnalyticsPayload, (result) => {
		if (!result.success) {
			throw new ValidationError({
				global: [{ message: "Invalid analytics payload" }],
			});
		}
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
```

---

### 12. **apps/api/package.json** (40 lines)

**Dependencies and scripts.**

**Key Dependencies:**

```json
{
	"name": "@chevrotain/api",
	"type": "module",
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
	}
}
```

**External Dependencies Used:**

- `hono` - HTTP framework
- `@rocicorp/zero` - Sync protocol and server helpers
- `effect` - Functional error handling and runtime
- `autumn-js` - Billing service
- `@opentelemetry/*` - Distributed tracing
- `@hono/prometheus` - Metrics collection
- `prom-client` - Prometheus client

---

### 13. **apps/api/rolldown.config.ts** (12 lines)

**Build configuration.**

**Key Details:**

- Input: `["src/server.ts", "src/instrumentation.ts"]`
- Output: ESM format, sourcemaps enabled
- Platform: Node.js
- External modules: `pg`, `@opentelemetry/instrumentation-pg`

```typescript
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

## Web Client Usage

### **apps/web/src/clients/api.ts** (9 lines)

**Hono typed client for API calls.**

```typescript
import { hc } from "hono/client";
import type { Routes } from "@chevrotain/api/index";

export const { api } = hc<Routes>(import.meta.env.VITE_BASE_URL!, {
	init: {
		credentials: "include",
	},
});
```

**Usage Pattern:**

```typescript
// POST with JSON body
await api.analytics.$post({ json: { events } });

// POST with errors
await api.errors.$post({ json: { errors } });
```

### **apps/web/src/lib/analytics.ts** (220 lines)

**Client-side analytics tracking.**

**Event Types:**

- `eventType` - string identifier ("page_view", "button_click", etc.)
- `url` - current page URL
- `referrer` - referring page
- `properties` - optional metadata object

**Buffer Configuration:**

- Flush interval: 5 seconds
- Max buffer size: 50 events
- Max payload: 50 KB
- Error flush delay: 1 second
- Error dedup window: 60 seconds

**API Calls:**

```typescript
// Send events batch
await api.analytics.$post({ json: { events } });

// Send error reports
await api.errors.$post({ json: { errors } });
```

**Error Deduplication:**

- Fingerprint: `${errorType}:${message}`
- Prevents duplicate error reports within 60 second window

---

## Route Mount Structure

```
Hono App
├── /metrics (printMetrics from prometheus)
├── /up (health check)
├── /auth/* (better-auth handler)
├── /query (query.ts app)
│   └── POST / (Zero query)
├── /mutate (mutate.ts app)
│   └── POST / (Zero mutate)
├── /analytics (analytics/index.ts app)
│   └── POST / (event tracking)
├── /errors (errors/index.ts app)
│   └── POST / (error reporting)
└── /autumn (autumn.ts app)
    └── ALL /* (billing webhooks)
```

---

## Environment Variables

**Required:**

- `BASE_URL` - CORS origin (e.g., `http://localhost:34600`)
- `PORT` - Server port (e.g., `3005`)

**Optional (defaults to env-specific values):**

- `DATABASE_URL` - PostgreSQL connection
- `CLICKHOUSE_URL` - ClickHouse server URL
- `BETTER_AUTH_SECRET` - Auth signing key
- `OPENAI_API_KEY` - For AI suggestions (if implemented)
- `RESEND_API_KEY` - Email service
- `AUTUMN_API_KEY` - Billing service

---

## Middleware Stack

**Global Middleware (in order):**

1. `httpInstrumentationMiddleware()` - OpenTelemetry HTTP instrumentation
2. `registerMetrics` - Prometheus metrics registration
3. `cors()` - CORS handling
4. Route-specific: `authMiddleware` (for protected routes)

**CORS Configuration:**

```typescript
cors({
	origin: process.env.BASE_URL!,
	allowHeaders: ["Content-Type", "Authorization"],
	allowMethods: ["GET", "POST", "OPTIONS"],
	exposeHeaders: ["Content-Length"],
	credentials: true,
	maxAge: 600,
});
```

---

## Error Flow Diagram

```
Request
  ├─→ Middleware (validation, auth)
  │   └─→ Throws TaggedError or PublicError
  │       ↓
  └─→ Handler
      ├─→ runEffect() executes Effect
      │   ├─→ Service yields from AppLayer
      │   ├─→ Throws TaggedError
      │   └─→ Exit.isFailure → re-throw
      │
      └─→ Returns response or throws

Error Handler (app.onError)
  ├─→ Is TaggedError?
  │   ├─→ Yes: taggedErrorToStatus() + taggedErrorToResponse()
  │   │       If 500: log to ClickHouse, record OpenTelemetry span
  │   └─→ No: continue
  │
  ├─→ Is PublicError?
  │   ├─→ Yes: return structured error response
  │   └─→ No: continue
  │
  └─→ Unhandled error
      └─→ Log to ClickHouse, record OpenTelemetry span, return 500
```

---

## Graceful Shutdown Sequence

**Process:** SIGINT/SIGTERM
↓
**server.ts:** `shutdown()` function called
├─→ `server.close()` - Stop HTTP listener
├─→ `stopRateLimitCleanup()` - Clear rate limit timer
├─→ `shutdownRuntime()` - Close DB pool, ClickHouse client, etc.
└─→ `shutdownTelemetry()` - Flush traces, shutdown tracer provider

---

## Testing Patterns (from test files)

**Example test setup:**

```typescript
describe("endpoint", () => {
	// Mock middleware
	vi.mock("@chevrotain/api/middleware/auth", () => ({
		authMiddleware: vi.fn((c, next) => {
			c.set("user", { id: "test-user-id" });
			c.set("session", { id: "test-session-id" });
			return next();
		}),
	}));

	// Mock Effect runtime
	vi.mock("@chevrotain/api/runtime", () => ({
		runEffect: vi.fn((_effect) => Promise.resolve()),
	}));

	it("returns 200 with valid payload", async () => {
		const response = await app.request("/api/endpoint", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				/* payload */
			}),
		});

		expect(response.status).toBe(200);
		expect(runEffect).toHaveBeenCalledOnce();
	});
});
```

---

## Migration Considerations for @effect/platform HttpApi

### What to Keep:

- Effect-based error handling pattern
- Service composition (AppLayer)
- OpenTelemetry instrumentation approach
- Error mapping logic
- Rate limiting implementation

### What to Migrate:

1. **Route Definitions** - Hono app structure → HttpApi
2. **Middleware** - Hono middleware → HttpApi middleware
3. **Request/Response** - Hono context (c.req, c.json) → HttpApi equivalents
4. **Error Handling** - Hono .onError() → HttpApi error handling
5. **Server Entry** - @hono/node-server → @effect/platform HttpApi server

### Key Patterns to Maintain:

- Typed routes export: `export type Routes = typeof app;`
- Auth context variables in request
- Effect runtime running inside handlers
- OpenTelemetry span recording
- Consistent error response format

---

## Summary Statistics

| Metric                     | Count                       |
| -------------------------- | --------------------------- |
| API files                  | 9                           |
| Routes mounted             | 7                           |
| Auth-required routes       | 5                           |
| Public routes              | 2                           |
| HTTP methods               | 4 (GET, POST, OPTIONS, ALL) |
| Error types handled        | 9                           |
| Service layers             | 4                           |
| Dependencies               | 16                          |
| OpenTelemetry instruments  | 2                           |
| Web client files using API | 1 (analytics.ts)            |

---

## Notes

- No `/suggestions` endpoint exists yet (mentioned in AGENTS.md but not implemented)
- Zero protocol handled via `@rocicorp/zero/server` helpers, not custom HTTP handlers
- All database operations use Drizzle ORM via Effect-managed DatabaseService
- Analytics events stored in ClickHouse, not PostgreSQL
- Better-auth handles all `/api/auth/*` routes (not custom handlers in this app)
- Effect runtime is app-level singleton (ManagedRuntime), not per-request
- Prometheus metrics collected at `/api/metrics`
