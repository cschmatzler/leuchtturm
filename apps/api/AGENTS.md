# @one/api - Hono API Server

## Overview

Hono API with Node.js. All routes under `/api`. Auth via better-auth.

## Structure

```
src/
├── index.ts              # Main app, routes, error handling, server
├── server.ts             # Server entry point
├── query.ts              # Read-only endpoints (Zero queries)
├── mutate.ts             # Write endpoints (Zero mutations)
├── autumn.ts              # Billing webhooks (autumn-js)
├── instrumentation.ts    # OpenTelemetry setup
├── analytics/
│   ├── index.ts          # Analytics endpoints (ClickHouse)
│   └── clickhouse.ts     # ClickHouse client
├── suggestions/
│   └── index.ts          # AI suggestion generation
└── middleware/
    └── auth.ts           # Auth middleware
```

## Where to Look

| Task                    | Location                  |
| ----------------------- | ------------------------- |
| Add GET endpoint        | `index.ts` or `query.ts`  |
| Add POST endpoint       | `index.ts` or `mutate.ts` |
| Modify auth middleware  | `middleware/auth.ts`      |
| Handle billing webhooks | `autumn.ts`               |
| Add analytics tracking  | `analytics/`              |
| AI suggestions          | `suggestions/`            |

## Conventions

### Error Handling

All errors return consistent format:

```typescript
{
  success: false,
  error: {
    global: [{ code: "...", message: "..." }],
    fields: [{ path: [...], message: "..." }]
  }
}
```

Use `PublicError` for intentional errors:

```typescript
throw new PublicError({ status: 403, global: [{ message: "Forbidden" }] });
throw new PublicError({
	status: 400,
	fields: [{ path: ["email"], message: "Invalid email" }],
});
```

### Auth Middleware

Routes requiring auth use the `authMiddleware`:

```typescript
import { authMiddleware } from "@one/api/middleware/auth";

app.get("/protected", authMiddleware, async (c) => {
	const user = c.get("user");
	const session = c.get("session");
	const organization = c.get("organization");
	// ...
});
```

`authMiddleware` sets:

- `user` - Current user from session
- `session` - Current session
- `organization` - Active organization

### Route Grouping

Sub-routes are defined as separate Hono apps and mounted:

```typescript
// query.ts
const app = new Hono().use(authMiddleware).post("/", handler);
export default app;

// index.ts
app.route("/query", query);
```

### Type Export

`Routes` type exported for `hc` client type safety:

```typescript
export type Routes = typeof app;

// In web client:
import { hc } from "hono/client";
const api = hc<Routes>(baseUrl).api;
const res = await api.deviceSessions.$get();
```

### Zero Endpoints

Zero uses two dedicated endpoints:

- `/api/query` - Read operations via `query.ts`
- `/api/mutate` - Write operations via `mutate.ts`

These handle Zero's sync protocol, not standard REST.

### Error Boundaries

The main app in `index.ts` has global error handling:

```typescript
app.onError((error, c) => {
	if (error instanceof PublicError) {
		return c.json(
			{
				success: false,
				error: { global: error.global, fields: error.fields },
			},
			error.status ?? 500,
		);
	}
	// ... telemetry and 500 handling
});
```

### CORS Configuration

CORS is configured in `index.ts`:

```typescript
app.use(
	cors({
		origin: process.env.BASE_URL!,
		allowHeaders: ["Content-Type", "Authorization"],
		allowMethods: ["GET", "POST", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		credentials: true,
		maxAge: 600,
	}),
);
```

### Better-Auth Integration

Auth routes mounted at `/api/auth/*`:

```typescript
app.all("/auth/*", (c) => auth.handler(c.req.raw));
```

Auth configuration is in `@one/core/auth`.

### Analytics

Analytics endpoints in `analytics/` use ClickHouse:

- Event ingestion via POST `/api/analytics`
- Query endpoints for dashboards
- OpenTelemetry instrumentation

ClickHouse client pattern:

```typescript
export async function insertEvents(events: AnalyticsEvent[], userId?: string, sessionId?: string) {
	await analyticsClient.insert({
		table: "analytics_events",
		values: events.map((event) => ({
			...event,
			user_id: userId,
			session_id: sessionId,
			timestamp: event.timestamp || Date.now(),
		})),
		format: "JSONEachRow",
	});
}
```

### Suggestions

AI suggestion generation in `suggestions/`:

1. Validates input with arktype
2. Calls external AI service (OpenAI)
3. Handles billing/compensation on failure
4. Returns structured suggestions

Pattern:

```typescript
export async function generateSuggestion(
	userId: string,
	dialingSessionId: string,
	brewId: string,
): Promise<SuggestionParams> {
	// 1. Fetch brew history
	// 2. Build prompt
	// 3. Call OpenAI
	// 4. Parse response
	// 5. Return structured data
}
```

### Billing Webhooks

Autumn billing webhooks in `autumn.ts`:

- Subscription events
- Payment processing
- Seat tracking

## Anti-Patterns

| Never                | Instead                                  |
| -------------------- | ---------------------------------------- |
| Blocking operations  | Use async/await properly                 |
| Log sensitive data   | Redact tokens, passwords                 |
| Skip auth checks     | Use `authMiddleware`                     |
| Return data directly | Use `c.json()` or `c.text()`             |
| Swallow errors       | Rethrow or return proper error responses |
| Manual CORS headers  | Use `cors()` middleware                  |

## Testing

API tests use vitest with Hono's test client:

```typescript
import { describe, it, expect } from "vite-plus/test";
import { vi } from "vite-plus/test";

describe("analytics", () => {
	it("should track event", async () => {
		const res = await app.request("/api/analytics", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ event: "test" }),
		});
		expect(res.status).toBe(200);
	});
});
```

### Mock Patterns

Mock modules with `vi.mock`:

```typescript
vi.mock("@one/email", () => ({
	resend: {
		emails: {
			send: vi.fn(),
		},
	},
}));

vi.mock("@one/api/middleware/auth", () => ({
	authMiddleware: vi.fn((c, next) => {
		c.set("user", { id: "test-user-id" });
		return next();
	}),
}));
```

Use `vi.hoisted()` for module-level mocks:

```typescript
const { mockInsert } = vi.hoisted(() => ({
	mockInsert: vi.fn(),
}));

vi.mock("@one/core/analytics/clickhouse", () => ({
	analyticsClient: { insert: mockInsert },
}));
```

## Build Configuration

Rolldown config in `rolldown.config.ts`:

- Builds to `dist/` directory
- Includes all dependencies in bundle
- Server entry point is `server.ts`
- ESM format with sourcemaps

## Environment Variables

Required env vars (loaded from secrets):

| Variable             | Purpose                     |
| -------------------- | --------------------------- |
| `BASE_URL`           | CORS origin                 |
| `PORT`               | Server port (default: 3005) |
| `DATABASE_URL`       | PostgreSQL connection       |
| `RESEND_API_KEY`     | Email service               |
| `AUTUMN_API_KEY`     | Billing service             |
| `CLICKHOUSE_URL`     | Analytics database          |
| `BETTER_AUTH_SECRET` | Auth signing key            |
| `OPENAI_API_KEY`     | AI suggestions              |

### Development (devenv)

```bash
PORT=3005
BASE_URL=http://localhost:34600
DATABASE_URL=postgres://postgres:postgres@localhost:34601/one
CLICKHOUSE_URL=http://localhost:34602
BETTER_AUTH_SECRET=dev-secret
```

### Production

Loaded from SOPS-encrypted `secrets/*.env` files via `sops-nix`.

## OpenTelemetry

Instrumentation in `instrumentation.ts`:

- OTLP exporter to Alloy
- Batch span processing
- Service name: `one-api`
- Automatic trace propagation

Metrics:

- `roasted_api_requests_total` - Request counter
- `roasted_api_request_duration` - Latency histogram
- `roasted_api_errors_total` - Error counter

## API Endpoints Reference

### Auth Routes

| Method | Path          | Description          |
| ------ | ------------- | -------------------- |
| ALL    | `/api/auth/*` | Better-auth handlers |

### Query Routes

| Method | Path         | Description         |
| ------ | ------------ | ------------------- |
| POST   | `/api/query` | Zero query endpoint |

### Mutate Routes

| Method | Path          | Description            |
| ------ | ------------- | ---------------------- |
| POST   | `/api/mutate` | Zero mutation endpoint |

### Analytics Routes

| Method | Path             | Description           |
| ------ | ---------------- | --------------------- |
| POST   | `/api/analytics` | Track analytics event |

### Suggestions Routes

| Method | Path               | Description            |
| ------ | ------------------ | ---------------------- |
| POST   | `/api/suggestions` | Generate AI suggestion |

### Billing Routes

| Method | Path                   | Description             |
| ------ | ---------------------- | ----------------------- |
| POST   | `/api/webhooks/autumn` | Autumn billing webhooks |

## Handler Pattern

All handlers follow the pattern:

```typescript
app.post("/endpoint", authMiddleware, async (c) => {
	// 1. Get authenticated user
	const user = c.get("user");
	const session = c.get("session");

	// 2. Validate input
	const body = await c.req.json();
	const parsed = Schema.parse(body);

	// 3. Perform operation
	const result = await performOperation(parsed, user.id);

	// 4. Return response
	return c.json({ success: true, data: result });
});
```

## Error Response Format

All errors follow the same structure:

```typescript
// Global error
{
  "success": false,
  "error": {
    "global": [
      { "message": "Something went wrong", "code": "ERROR_CODE" }
    ],
    "fields": []
  }
}

// Field error
{
  "success": false,
  "error": {
    "global": [],
    "fields": [
      { "path": ["email"], "message": "Invalid email format" }
    ]
  }
}
```
