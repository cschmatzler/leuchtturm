# Effect v4 Migration Plan

## Scope Assessment

| Package          | Fit      | Rationale                                                                                                                                                                     |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`  | **High** | Services, DB, auth, analytics, billing, error types — all benefit from Effect's DI, resource management, and typed error channels                                             |
| `apps/api`       | **High** | Handler composition, error handling, telemetry, config — `Effect.gen` replaces imperative async/await with composable pipelines                                               |
| `packages/zero`  | **Skip** | Zero controls its own transaction lifecycle (`tx.mutate`, `tx.run`). Mutator signatures are dictated by `@rocicorp/zero`. Adding Effect here creates friction with no benefit |
| `apps/web`       | **Skip** | React hooks-driven (useState, useZeroQuery, TanStack Form). No complex async orchestration. Effect adds no value to reactive UI                                               |
| `packages/email` | **Skip** | Two rendering functions. Not worth the overhead                                                                                                                               |

## What Stays the Same

- **Hono** as HTTP framework (bridged to Effect via `ManagedRuntime`)
- **`hc` type-safe client** in the web app (depends on Hono's `typeof app` export)
- **arktype** for validation (not switching to `@effect/schema` — the repo is deeply integrated with arktype)
- **Drizzle table definitions** (`.sql.ts` files stay as-is, accessed through `drizzle-orm/effect-postgres`)
- **better-auth** configuration (wrapped in an Effect Service, internals unchanged)
- **Zero** mutators, queries, schema — entirely untouched
- **Web app** — entirely untouched
- **Email** package — entirely untouched

## Research Notes

### Effect v4 Service Pattern

Effect v4 introduces `Effect.Service`, which combines a Tag and a Layer into a single class declaration. This replaces the old `Context.Tag` + `Layer.effect` two-step pattern.

```typescript
// Effect v4 Service definition
class MyService extends Effect.Service<MyService>()("MyService", {
	// Choose ONE of: sync, effect, or scoped
	effect: Effect.gen(function* () {
		const dep = yield* SomeDependency;
		return {
			doThing: (x: string) => Effect.succeed(x.toUpperCase()),
		};
	}),
	// Optionally generate top-level accessors (e.g. MyService.doThing(...))
	accessors: true,
	// Declare Layer dependencies — folded into MyService.Default automatically
	dependencies: [SomeDependency.Default],
}) {}

// Usage:
// MyService.Default    → Layer<MyService>           (includes dependencies)
// MyService.DefaultWithoutDependencies → Layer<MyService, never, SomeDependency>
// yield* MyService     → access the service in Effect.gen
```

Key points from the Effect docs:

- `sync: () => ({...})` — for services with no effectful setup
- `effect: Effect.gen(...)` — for services needing async init or other services
- `scoped: Effect.gen(...)` — for services with resource lifecycle (acquireRelease)
- `dependencies: [...]` — automatically merged into `.Default` layer
- `accessors: true` — generates static methods that delegate to the service

### Effect + Hono Integration (Cap Pattern)

Cap (CapSoftware/Cap) uses Effect + Hono in production. Their bridge pattern from `apps/web/lib/server.ts`:

```typescript
// 1. Compose all service layers
const Dependencies = Layer.mergeAll(
	S3Buckets.Default,
	Videos.Default,
	Database.Default,
	// ... all services
);

// 2. Create a managed runtime (lives for the app's lifetime)
const EffectRuntime = ManagedRuntime.make(Dependencies);

// 3. Bridge function: runs an Effect inside a Hono handler
export const runPromise = <A, E>(
	effect: Effect.Effect<A, E, Layer.Layer.Success<typeof Dependencies>>,
) =>
	EffectRuntime.runPromiseExit(effect).then((res) => {
		if (Exit.isFailure(res)) {
			if (Cause.isDieType(res.cause)) throw res.cause.defect;
			throw res;
		}
		return res.value;
	});
```

This means:

- Hono stays as the HTTP router and middleware framework
- Each handler calls `runPromise(Effect.gen(function* () { ... }))` internally
- The `ManagedRuntime` holds all service layers and manages their lifecycle
- Services are accessed via `yield*` inside `Effect.gen`
- Auth middleware remains Hono-native (it bridges to better-auth's session API)

### Drizzle + Effect Integration (Native)

Drizzle ORM has **native** Effect support built into `drizzle-orm/effect-postgres` (available since `drizzle-orm@1.0.0-beta.9`). This is NOT the `@effect/sql-drizzle` package — it's built directly into Drizzle itself. See https://orm.drizzle.team/docs/connect-effect-postgres

It uses `@effect/sql-pg` for the underlying connection pool. Queries return `Effect` values that can be `yield*`'d in `Effect.gen` blocks.

```typescript
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { PgClient } from "@effect/sql-pg";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { types } from "pg";

// 1. Configure the PgClient layer
const PgClientLive = PgClient.layer({
	url: Redacted.make(process.env.DATABASE_URL!),
	types: {
		getTypeParser: (typeId, format) => {
			// Return raw values for date/time types to let Drizzle handle parsing
			if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
				return (val: any) => val;
			}
			return types.getTypeParser(typeId, format);
		},
	},
});

// 2. Create Drizzle instance as an Effect
const program = Effect.gen(function* () {
	const db = yield* PgDrizzle.makeWithDefaults();
	const users = yield* db.select().from(usersTable);
	return users;
});

Effect.runPromise(program.pipe(Effect.provide(PgClientLive)));
```

For DI, wrap in a Layer:

```typescript
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as relations from "./schema/relations";

const dbEffect = PgDrizzle.make({ relations }).pipe(Effect.provide(PgDrizzle.DefaultServices));

class DB extends Context.Tag("DB")<DB, Effect.Effect.Success<typeof dbEffect>>() {}

const DBLive = Layer.effect(DB, dbEffect);
const AppLive = Layer.provideMerge(DBLive, PgClientLive);
```

**Version compatibility note**: Published Drizzle betas list `@effect/sql-pg: ^0.49.7` as a peer dependency (Effect v3 range). However, at runtime `drizzle-orm/effect-postgres` ONLY imports `PgClient` from `@effect/sql-pg/PgClient` — and this export exists identically in `@effect/sql-pg@4.0.0-beta.33`. The Drizzle `.d.ts` files reference `@effect/sql/SqlError` (a v3 package that doesn't exist in v4), but the root tsconfig has `skipLibCheck: true`, so these opaque type references won't cause build errors. The peer dep mismatch will produce pnpm warnings but no runtime issues.

### Tagged Errors (Effect v4)

Effect uses `Data.TaggedError` for type-safe, discriminated error types:

```typescript
import { Data, Effect } from "effect";

// Define errors
class NotFoundError extends Data.TaggedError("NotFoundError")<{
	resource?: string;
}> {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{
	message: string;
}> {}

// Use in effects
const getUser = (id: string): Effect.Effect<User, NotFoundError | DatabaseError> =>
	Effect.gen(function* () {
		const result = yield* queryDatabase(id);
		if (!result) return yield* new NotFoundError({ resource: "user" });
		return result;
	});

// Handle specific errors with catchTag
const handled = getUser(id).pipe(
	Effect.catchTag("NotFoundError", (e) => Effect.succeed({ id: e.resource, name: "Guest" })),
);
// Type: Effect<User, DatabaseError>
// NotFoundError is removed from the error channel
```

Key points:

- `_tag` is automatically set from the string passed to `Data.TaggedError`
- Errors are structurally equal (value semantics via `Data`)
- `Effect.catchTag` narrows the error channel type
- Never use `throw` inside `Effect.gen` — always use `Effect.fail` or `yield* new TaggedError()`
- `throw` inside Effect creates a "Defect" (unrecoverable crash), not a typed error

### Effect Config

Effect provides `Config` for type-safe environment variable access:

```typescript
import { Config, Effect } from "effect";

// Basic usage
const port = yield * Config.number("PORT");
const dbUrl = yield * Config.string("DATABASE_URL");
const secret = yield * Config.redacted("BETTER_AUTH_SECRET");

// With defaults
const clickhouseUrl =
	yield * Config.string("CLICKHOUSE_URL").pipe(Config.withDefault("http://localhost:8123"));

// Nested config
const dbConfig = Config.all({
	url: Config.string("DATABASE_URL"),
	poolSize: Config.number("DB_POOL_SIZE").pipe(Config.withDefault(10)),
});

// Fails at startup with clear error message if missing:
// "Missing configuration: DATABASE_URL"
```

This replaces the current `process.env.X!` pattern which silently produces `undefined` at runtime.

### Effect Built-in Telemetry

Effect has first-class OpenTelemetry support. Every `Effect.gen` block, every service call, every `yield*` is automatically traced. This can replace the manual `@hono/otel` + `@opentelemetry/*` setup:

```typescript
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

const TracingLayer = NodeSdk.layer(() => ({
	resource: { serviceName: "one-api" },
	spanProcessor: new BatchSpanProcessor(
		new OTLPTraceExporter({ url: "http://alloy:4318/v1/traces" }),
	),
}));

// Add to AppLayer — all Effects are now automatically traced
const AppLayer = Layer.mergeAll(DatabaseService.Default, AuthService.Default, TracingLayer);
```

### Anti-Patterns to Avoid

From the Effect TS skills repo (`effect-ts-anti-patterns/SKILL.md`):

| Anti-Pattern                               | Why                                              | Correct                                  |
| ------------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| `yield` without `*`                        | Returns the Effect object, not its value         | `yield*`                                 |
| `throw new Error()` inside `Effect.gen`    | Creates a Defect (crash), bypasses error channel | `yield* Effect.fail(new TaggedError())`  |
| `await Effect.runPromise(fx)` mid-function | Bypasses error channel and tracing               | `yield* fx` (compose effects)            |
| `Effect.all(tasks)` on large arrays        | Unbounded parallelism, OOM risk                  | `Effect.all(tasks, { concurrency: 10 })` |
| `try/finally` for cleanup                  | Bypasses Effect's interruption model             | `Effect.acquireRelease(...)`             |
| Scattering `Effect.runPromise`             | Loses context, tracing, interruption safety      | Compose effects, run ONCE at boundary    |

**The golden rule**: Effects should be composed with `yield*` and run at the boundary (Hono handler or server entry point). Never `Effect.runPromise` inside a helper function.

---

## Phase 1: Foundation (`packages/core`)

### 1.1 Add Effect Dependencies

Add to `packages/core/package.json`:

```json
{
	"dependencies": {
		"effect": "4.0.0-beta.33",
		"@effect/sql-pg": "4.0.0-beta.33",
		"@effect/opentelemetry": "4.0.0-beta.33",
		"@effect/platform-node": "4.0.0-beta.33"
	}
}
```

Add to `apps/api/package.json`:

```json
{
	"dependencies": {
		"effect": "4.0.0-beta.33"
	}
}
```

Add `@effect/vitest` as a dev dependency at the root or in each test-bearing package:

```json
{
	"devDependencies": {
		"@effect/vitest": "4.0.0-beta.33"
	}
}
```

**No `@effect/sql` or `@effect/sql-drizzle` needed** — in v4, SQL modules moved into the main `effect` package (`effect/unstable/sql/*`), and Drizzle's own `drizzle-orm/effect-postgres` replaces `@effect/sql-drizzle`.

Drizzle's peer dependency on `@effect/sql-pg: ^0.49.7` will produce pnpm warnings since we're installing `4.0.0-beta.33`. This is expected and harmless — the runtime API is identical (see Research Notes above).

### 1.2 Define Tagged Errors

Create `packages/core/src/errors.ts` with domain-specific tagged errors:

```typescript
import { Data } from "effect";

// --- HTTP-mappable errors ---

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
	readonly resource?: string;
	readonly message?: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
	readonly message?: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
	readonly message?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly fields?: ReadonlyArray<{
		readonly path: ReadonlyArray<string | number>;
		readonly message: string;
		readonly code?: string;
	}>;
	readonly global?: ReadonlyArray<{
		readonly message: string;
		readonly code?: string;
	}>;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
	readonly message?: string;
}> {}

// --- Infrastructure errors ---

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	readonly cause: unknown;
}> {}

export class ClickHouseError extends Data.TaggedError("ClickHouseError")<{
	readonly cause: unknown;
}> {}

export class EmailError extends Data.TaggedError("EmailError")<{
	readonly cause: unknown;
}> {}

export class BillingError extends Data.TaggedError("BillingError")<{
	readonly cause: unknown;
}> {}
```

The existing `PublicError` in `result.ts` stays — Zero mutators still use it. The Hono error handler maps both `PublicError` (from Zero) and TaggedErrors (from Effect) to the same HTTP response format.

### 1.3 Create `AppConfig` Service

Replace all `process.env.X` access with a typed config service:

```typescript
// packages/core/src/config.ts
import { Config, Effect, Redacted } from "effect";

export class AppConfig extends Effect.Service<AppConfig>()("AppConfig", {
	effect: Effect.gen(function* () {
		return {
			baseUrl: yield* Config.string("BASE_URL"),
			port: yield* Config.number("PORT").pipe(Config.withDefault(3005)),
			databaseUrl: yield* Config.redacted("DATABASE_URL"),
			clickhouseUrl: yield* Config.string("CLICKHOUSE_URL").pipe(
				Config.withDefault("http://localhost:8123"),
			),
			betterAuthSecret: yield* Config.redacted("BETTER_AUTH_SECRET"),
			resendApiKey: yield* Config.redacted("RESEND_API_KEY"),
			autumnSecretKey: yield* Config.redacted("AUTUMN_SECRET_KEY"),
			githubClientId: yield* Config.string("GITHUB_CLIENT_ID").pipe(Config.withDefault("")),
			githubClientSecret: yield* Config.string("GITHUB_CLIENT_SECRET").pipe(Config.withDefault("")),
			openaiApiKey: yield* Config.redacted("OPENAI_API_KEY").pipe(Config.option),
		};
	}),
}) {}
```

This fails early at startup with a clear error (`ConfigError: Missing configuration: DATABASE_URL`) instead of silently passing `undefined` through the app.

### 1.4 Create `DatabaseService`

Replace the current singleton `db` export with a managed service using Drizzle's native Effect support (`drizzle-orm/effect-postgres`):

```typescript
// packages/core/src/drizzle/service.ts
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { PgClient } from "@effect/sql-pg";
import { Context, Config, Effect, Layer, Redacted } from "effect";
import { types } from "pg";
import * as relations from "@one/core/auth/auth.sql";

// PgClient layer — manages the connection pool lifecycle
// PgClient.layer uses acquireRelease internally to guarantee pool.end() on shutdown
const PgClientLive = Layer.unwrapEffect(
	Effect.gen(function* () {
		const databaseUrl = yield* Config.redacted("DATABASE_URL");
		return PgClient.layer({
			url: databaseUrl,
			types: {
				getTypeParser: (typeId, format) => {
					// Return raw values for date/time types — let Drizzle handle parsing
					if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
						return (val: unknown) => val;
					}
					return types.getTypeParser(typeId, format);
				},
			},
		});
	}),
);

// Create the Drizzle Effect with default services (no logging, no caching)
const dbEffect = PgDrizzle.make({ relations }).pipe(Effect.provide(PgDrizzle.DefaultServices));

// DB service tag for dependency injection
export class DatabaseService extends Context.Tag("DatabaseService")<
	DatabaseService,
	Effect.Effect.Success<typeof dbEffect>
>() {
	// Layer that provides both PgClient and the Drizzle instance
	static Live = Layer.effect(DatabaseService, dbEffect).pipe(Layer.provide(PgClientLive));
}
```

Current code (`packages/core/src/drizzle/index.ts`):

```typescript
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, relations: { ...authRelations } });
```

The current pattern has no shutdown handling — the pool is never closed. `PgClient.layer` uses `acquireRelease` internally to guarantee the pool is closed on shutdown.

Usage in handlers:

```typescript
Effect.gen(function* () {
	const db = yield* DatabaseService;
	const users = yield* db.select().from(userTable);
	return users;
});
```

> **Important**: The raw `db` export must remain available for better-auth's `drizzleAdapter()`, which expects a plain Drizzle instance. Keep the existing `drizzle/index.ts` for better-auth interop; the `DatabaseService` is used for all Effect-managed database access.

### 1.5 Create `ClickHouseService`

```typescript
// packages/core/src/analytics/service.ts
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { Effect } from "effect";
import { AppConfig } from "@one/core/config";
import { ClickHouseError } from "@one/core/errors";
import type { AnalyticsEvent } from "@one/core/analytics/schema";

export class ClickHouseService extends Effect.Service<ClickHouseService>()("ClickHouseService", {
	accessors: true,
	scoped: Effect.gen(function* () {
		const config = yield* AppConfig;

		const client = yield* Effect.acquireRelease(
			Effect.sync(() =>
				createClient({
					url: config.clickhouseUrl,
					clickhouse_settings: { async_insert: 1, wait_end_of_query: 1 },
				}),
			),
			(client) => Effect.promise(() => client.close()),
		);

		const insertEvents = (events: AnalyticsEvent[], userId: string, sessionId: string) =>
			Effect.tryPromise({
				try: () =>
					client.insert({
						table: "analytics_events",
						values: events.map((event) => ({
							timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
							event_id: crypto.randomUUID(),
							session_id: sessionId,
							user_id: userId,
							event_type: event.eventType,
							url: event.url,
							referrer: event.referrer,
							properties: JSON.stringify(event.properties ?? {}),
						})),
						format: "JSONEachRow",
					}),
				catch: (cause) => new ClickHouseError({ cause }),
			});

		const insertErrors = (
			errors: Array<{
				source: "api" | "web";
				errorType: string;
				message: string;
				userId?: string;
				sessionId?: string;
				stackTrace?: string;
				url?: string;
				method?: string;
				statusCode?: number;
				userAgent?: string;
				properties?: Record<string, unknown>;
			}>,
		) =>
			Effect.tryPromise({
				try: () =>
					client.insert({
						table: "error_events",
						values: errors.map((error) => ({
							timestamp: new Date().toISOString().replace("T", " ").replace("Z", ""),
							error_id: crypto.randomUUID(),
							source: error.source,
							user_id: error.userId ?? "",
							session_id: error.sessionId ?? "",
							error_type: error.errorType,
							message: error.message,
							stack_trace: error.stackTrace ?? "",
							url: error.url ?? "",
							method: error.method ?? "",
							status_code: error.statusCode ?? 0,
							user_agent: error.userAgent ?? "",
							properties: JSON.stringify(error.properties ?? {}),
						})),
						format: "JSONEachRow",
					}),
				catch: (cause) => new ClickHouseError({ cause }),
			});

		return { client, insertEvents, insertErrors };
	}),
	dependencies: [AppConfig.Default],
}) {}
```

Note the use of `scoped` instead of `effect` — this tells Effect the service acquires resources that need cleanup. The ClickHouse client is acquired and released via `Effect.acquireRelease`, guaranteeing `client.close()` runs on shutdown.

Current code (`packages/core/src/analytics/clickhouse.ts`) has no cleanup:

```typescript
const client = createClient({ url: process.env.CLICKHOUSE_URL ?? "..." });
// client is never closed
```

### 1.6 Create `BillingService`

```typescript
// packages/core/src/billing/service.ts
import { Autumn } from "autumn-js";
import { Effect, Redacted } from "effect";
import { AppConfig } from "@one/core/config";
import { BillingError } from "@one/core/errors";

export class BillingService extends Effect.Service<BillingService>()("BillingService", {
	effect: Effect.gen(function* () {
		const config = yield* AppConfig;
		const autumn = new Autumn({
			secretKey: Redacted.value(config.autumnSecretKey),
		});

		return {
			autumn,
			getOrCreateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.getOrCreate(params),
					catch: (cause) => new BillingError({ cause }),
				}),
			updateCustomer: (params: { customerId: string; name: string; email: string }) =>
				Effect.tryPromise({
					try: () => autumn.customers.update(params),
					catch: (cause) => new BillingError({ cause }),
				}),
		};
	}),
	dependencies: [AppConfig.Default],
}) {}
```

Current code (`packages/core/src/billing/autumn.ts`):

```typescript
const autumn = new Autumn({ secretKey: process.env.AUTUMN_SECRET_KEY });
```

### 1.7 Create `EmailService`

```typescript
// packages/core/src/email/service.ts
import { Effect, Redacted } from "effect";
import { Resend } from "resend";
import { AppConfig } from "@one/core/config";
import { EmailError } from "@one/core/errors";

export class EmailService extends Effect.Service<EmailService>()("EmailService", {
	effect: Effect.gen(function* () {
		const config = yield* AppConfig;
		const resend = new Resend(Redacted.value(config.resendApiKey));

		return {
			send: (params: { from: string; to: string; subject: string; html: string; text: string }) =>
				Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (cause) => new EmailError({ cause }),
				}),
		};
	}),
	dependencies: [AppConfig.Default],
}) {}
```

### 1.8 Replace `assert()` with Effect-native helper

```typescript
// packages/core/src/assert.ts (updated)
import { Effect } from "effect";
import { NotFoundError } from "@one/core/errors";

/**
 * Effect-native version: returns Effect.fail(NotFoundError) instead of throwing.
 * Use inside Effect.gen blocks.
 */
export const assertFound = <T>(
	value: T | null | undefined,
	resource?: string,
): Effect.Effect<T, NotFoundError> =>
	value != null ? Effect.succeed(value) : Effect.fail(new NotFoundError({ resource }));

// Keep the throwing version for Zero mutators (they can't use Effect)
export { assert } from "@one/core/result-compat";
```

Usage comparison:

```typescript
// Before (throwing):
const [bean] = await db.select().from(beanTable).where(eq(beanTable.id, id)).limit(1);
assert(bean); // throws PublicError

// After (Effect):
const bean =
	yield *
	db
		.select()
		.from(beanTable)
		.where(eq(beanTable.id, id))
		.limit(1)
		.pipe(
			Effect.map((rows) => rows[0]),
			Effect.flatMap((row) => assertFound(row, "bean")),
		);
```

---

## Phase 2: API Layer (`apps/api`)

### 2.1 Create `ManagedRuntime` Bridge

This is the central piece — a single runtime that holds all service layers and bridges Effect into Hono handlers.

```typescript
// apps/api/src/runtime.ts
import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";
import { AppConfig } from "@one/core/config";
import { DatabaseService } from "@one/core/drizzle/service";
import { ClickHouseService } from "@one/core/analytics/service";
import { BillingService } from "@one/core/billing/service";
import { EmailService } from "@one/core/email/service";

// Compose all service layers
export const AppLayer = Layer.mergeAll(
	DatabaseService.Default,
	ClickHouseService.Default,
	BillingService.Default,
	EmailService.Default,
).pipe(Layer.provideMerge(AppConfig.Default));

// Type alias for the services available in handlers
export type AppServices = Layer.Layer.Success<typeof AppLayer>;

// Managed runtime — created once, lives for the app's lifetime
const AppRuntime = ManagedRuntime.make(AppLayer);

/**
 * Run an Effect inside a Hono handler.
 * This is the ONLY place Effect.runPromise should appear.
 */
export const runEffect = <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> =>
	AppRuntime.runPromiseExit(effect).then((exit) => {
		if (Exit.isFailure(exit)) {
			// Re-throw defects (bugs) as regular errors for Hono's .onError
			if (Cause.isDieType(exit.cause)) {
				throw exit.cause.defect;
			}
			// Re-throw typed failures — Hono's .onError will catch TaggedErrors
			const failure = Cause.failureOption(exit.cause);
			if (failure._tag === "Some") {
				throw failure.value;
			}
			throw exit;
		}
		return exit.value;
	});

/**
 * Shutdown the runtime (called on SIGINT/SIGTERM).
 * Closes all managed resources (DB pool, ClickHouse client, etc).
 */
export const shutdownRuntime = () => AppRuntime.dispose();
```

### 2.2 Error Mapping at Hono Boundary

Update the `.onError` handler to map tagged errors to HTTP responses:

```typescript
// apps/api/src/errors/mapping.ts
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	ValidationError,
	RateLimitError,
	DatabaseError,
	ClickHouseError,
	EmailError,
	BillingError,
} from "@one/core/errors";

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

const STATUS_MAP: Record<string, ContentfulStatusCode> = {
	NotFoundError: 404,
	UnauthorizedError: 401,
	ForbiddenError: 403,
	ValidationError: 400,
	RateLimitError: 429,
	DatabaseError: 500,
	ClickHouseError: 500,
	EmailError: 500,
	BillingError: 500,
};

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

Updated `.onError` in `apps/api/src/index.ts`:

```typescript
.onError((error, c) => {
  // Effect TaggedErrors
  if (isTaggedError(error)) {
    const status = taggedErrorToStatus(error);

    // Log infrastructure errors
    if (status === 500) {
      // ... telemetry, ClickHouse error logging
    }

    return c.json(
      { success: false, error: taggedErrorToResponse(error) },
      status,
    );
  }

  // Legacy PublicError (from Zero mutators — stays until Zero is decoupled)
  if (error instanceof PublicError) {
    return c.json(
      {
        success: false,
        error: { global: error.global, fields: error.fields },
      },
      (error.status ?? 500) as ContentfulStatusCode,
    );
  }

  // Unhandled defects
  // ... existing telemetry + 500 response
})
```

### 2.3 Convert Hono Handlers

#### Analytics Handler (before):

```typescript
// apps/api/src/analytics/index.ts (current)
app.post("/", sValidator("json", AnalyticsPayload, ...), async (c) => {
  const user = c.get("user");
  const session = c.get("session");
  const payload = c.req.valid("json");

  if (payload.events.length === 0) {
    return c.json({ success: true });
  }

  await insertEvents(payload.events, user.id, session.id);
  return c.json({ success: true });
});
```

#### Analytics Handler (after):

```typescript
// apps/api/src/analytics/index.ts (Effect)
app.post("/", sValidator("json", AnalyticsPayload, ...), async (c) => {
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
});
```

#### Error Reporting Handler (before):

```typescript
// apps/api/src/errors/index.ts (current)
app.post("/", sValidator(...), async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    throw new PublicError({ status: 429, global: [{ message: "Too many error reports" }] });
  }

  const payload = c.req.valid("json");
  await insertErrors(payload.errors.map(...));
  return c.json({ success: true });
});
```

#### Error Reporting Handler (after):

```typescript
// apps/api/src/errors/index.ts (Effect)
app.post("/", sValidator(...), async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = c.req.header("user-agent") ?? "";
  const payload = c.req.valid("json");

  await runEffect(
    Effect.gen(function* () {
      if (isRateLimited(ip)) {
        return yield* new RateLimitError({ message: "Too many error reports" });
      }

      if (payload.errors.length === 0) return;

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
});
```

### 2.4 Convert Server Lifecycle

```typescript
// apps/api/src/server.ts (after)
import { serve } from "@hono/node-server";
import { app } from "@one/api/index";
import { shutdownRuntime } from "@one/api/runtime";

const port = Number(process.env.PORT!);
const server = serve({ port, fetch: app.fetch });

console.log(`API server running on port ${port} (pid: ${process.pid})`);

async function shutdown() {
	server.close();
	await shutdownRuntime(); // closes DB pool, ClickHouse client, etc.
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

### 2.5 Replace OpenTelemetry Setup

Current `instrumentation.ts` manually sets up OTel with `@opentelemetry/*` packages. Effect has built-in tracing — every `Effect.gen`, every `yield*`, every service access is automatically traced.

```typescript
// apps/api/src/telemetry.ts (new)
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Layer } from "effect";

export const TelemetryLayer = NodeSdk.layer(() => ({
	resource: {
		serviceName: "one-api",
	},
	spanProcessor: new BatchSpanProcessor(
		new OTLPTraceExporter({
			url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
		}),
	),
}));
```

Add `TelemetryLayer` to `AppLayer`:

```typescript
export const AppLayer = Layer.mergeAll(
	DatabaseService.Default,
	ClickHouseService.Default,
	BillingService.Default,
	EmailService.Default,
	TelemetryLayer,
).pipe(Layer.provideMerge(AppConfig.Default));
```

After this, you can remove `@hono/otel`, `@opentelemetry/context-async-hooks`, `@opentelemetry/instrumentation`, `@opentelemetry/instrumentation-pg`, `@opentelemetry/instrumentation-undici`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base` from `apps/api/package.json`. Keep only `@opentelemetry/exporter-trace-otlp-http` and `@opentelemetry/api` (Effect uses the standard OTEL API).

The manual span recording in the error handler:

```typescript
const span = trace.getActiveSpan();
if (span) {
	span.recordException(normalizedError);
	span.setStatus({ code: SpanStatusCode.ERROR, message: normalizedError.message });
}
```

Becomes automatic — Effect records exceptions on the active span when an effect fails.

### 2.6 Query and Mutate Endpoints

These endpoints bridge Zero's sync protocol to Hono. They stay mostly the same since Zero controls the transaction lifecycle, but wrap the outer handler in Effect:

```typescript
// apps/api/src/mutate.ts (after)
const app = new Hono<{ Variables: AuthVariables }>().use(authMiddleware).post("/", async (c) => {
	const user = c.get("user");
	const ctx = { userId: user.id };

	const result = await runEffect(
		Effect.gen(function* () {
			const db = yield* DatabaseService;
			const dbProvider = zeroDrizzle(schema, db);

			return yield* Effect.tryPromise({
				try: () =>
					handleMutateRequest(
						dbProvider,
						async (transact) => {
							return await transact(async (tx, name, args) => {
								const mutator = mustGetMutator(mutators, name);
								return await mutator.fn({ tx, ctx, args });
							});
						},
						c.req.raw,
					),
				catch: (cause) => new DatabaseError({ cause }),
			});
		}),
	);

	return c.json(result);
});
```

> Note: Inside the `transact` callback, we're still in Zero's world — `async/await`, not `Effect.gen`. Zero mutators keep throwing `PublicError`. This is an intentional boundary.

---

## Phase 3: Testing and Cleanup

### 3.1 Update Tests

Effect provides `@effect/vitest` for testing Effect-based code:

```typescript
import { Effect, Layer } from "effect";
import { it, describe } from "@effect/vitest";
import { ClickHouseService } from "@one/core/analytics/service";

// Mock layer for testing
const MockClickHouse = Layer.succeed(ClickHouseService, {
  insertEvents: () => Effect.void,
  insertErrors: () => Effect.void,
  client: {} as any,
});

describe("analytics handler", () => {
  it.effect("inserts events", () =>
    Effect.gen(function* () {
      const analytics = yield* ClickHouseService;
      yield* analytics.insertEvents([...], "user-id", "session-id");
      // assertions...
    }).pipe(Effect.provide(MockClickHouse)),
  );
});
```

### 3.2 Remove Dead Code

After migration:

- Remove `packages/core/src/analytics/clickhouse.ts` (replaced by `ClickHouseService`)
- Remove `packages/core/src/billing/autumn.ts` (replaced by `BillingService`)
- Remove `apps/api/src/instrumentation.ts` (replaced by `TelemetryLayer`)
- Remove old `packages/core/src/drizzle/index.ts` export (replaced by `DatabaseService`)
- Remove unused OTel dependencies from `apps/api/package.json`

### 3.3 Verify

```bash
vp lint --type-aware --type-check  # Type check
vp test                             # Run all tests
treefmt                             # Format
```

---

## Migration Order

File-by-file order, designed so each step compiles independently:

```
 1. packages/core/package.json            ← Add effect, @effect/sql-pg, @effect/opentelemetry, @effect/platform-node
 2. apps/api/package.json                 ← Add effect
 3. pnpm install + nu scripts/update-pnpm-hash.nu
 4. packages/core/src/errors.ts           ← New TaggedError definitions
 5. packages/core/src/config.ts           ← AppConfig service
 6. packages/core/src/drizzle/service.ts  ← DatabaseService
 7. packages/core/src/analytics/service.ts ← ClickHouseService
 8. packages/core/src/billing/service.ts  ← BillingService
 9. packages/core/src/email/service.ts    ← EmailService (in packages/core, wrapping @one/email)
10. packages/core/src/assert.ts           ← Add assertFound (keep assert for Zero)
11. apps/api/src/runtime.ts              ← ManagedRuntime + AppLayer
12. apps/api/src/errors/mapping.ts       ← TaggedError → HTTP response mapping
13. apps/api/src/index.ts                ← Update .onError to handle TaggedErrors
14. apps/api/src/analytics/index.ts      ← First handler conversion
15. apps/api/src/errors/index.ts         ← Second handler conversion
16. apps/api/src/autumn.ts               ← Third handler conversion
17. apps/api/src/mutate.ts               ← Bridge handler (Zero interop)
18. apps/api/src/query.ts                ← Bridge handler (Zero interop)
19. apps/api/src/telemetry.ts            ← Effect OTEL layer
20. apps/api/src/server.ts               ← Shutdown via runtime.dispose()
21. Remove dead code + unused deps
22. vp lint --type-aware --type-check && vp test
```

---

## Dependency Graph

```
PgClient.layer (from @effect/sql-pg — manages connection pool lifecycle)
└── DatabaseService (drizzle-orm/effect-postgres — wraps PgClient into Drizzle)

AppConfig (effect/Config — typed env var access)
├── ClickHouseService (scoped — acquireRelease for client lifecycle)
├── BillingService (wraps autumn-js)
└── EmailService (wraps resend)

AppLayer = merge(DatabaseService.Live, ClickHouse, Billing, Email, Telemetry)

ManagedRuntime(AppLayer) → runEffect() → Hono handlers
```

---

## Risks and Mitigations

| Risk                                              | Mitigation                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| better-auth expects a raw Drizzle `db` instance   | Keep the existing `packages/core/src/drizzle/index.ts` with its plain `Pool` + `drizzle()` for better-auth's `drizzleAdapter()`. The `DatabaseService` is for Effect-managed access only. Two separate pools is acceptable — better-auth's pool handles auth routes, DatabaseService handles everything else.                                                                  |
| Zero mutators still throw `PublicError`           | Keep `PublicError` in `result.ts`. The Hono `.onError` handler checks for both `PublicError` (instanceof) and TaggedErrors (`_tag` property). This is an intentional boundary — Zero owns its lifecycle.                                                                                                                                                                       |
| `drizzle-orm/effect-postgres` peer dep mismatch   | Drizzle lists `@effect/sql-pg: ^0.49.7` (v3 range) but we use `4.0.0-beta.33`. At runtime, only `PgClient` is imported from `@effect/sql-pg/PgClient` — this export is identical in both versions. The `.d.ts` type references to `@effect/sql/SqlError` are handled by `skipLibCheck: true`. pnpm will warn but not fail.                                                     |
| Bundle size increase                              | Effect tree-shakes aggressively. Only the used modules are included. The entire `effect` package is ~50KB gzipped.                                                                                                                                                                                                                                                             |
| Team learning curve                               | The [effect-ts-skills](https://github.com/mrevanzak/effect-ts-skills) repo covers fundamentals, errors, resources, concurrency, and anti-patterns. Start with `effect-ts-fundamentals`, then `effect-ts-errors`.                                                                                                                                                               |
| Config fails at startup for missing optional vars | Use `Config.option` or `Config.withDefault` for truly optional variables. Only required vars should fail-fast.                                                                                                                                                                                                                                                                 |
| `@hono/otel` removal breaks existing traces       | Effect's OTEL integration uses the same `@opentelemetry/api` — spans will appear in the same format in Grafana/Alloy. The `@hono/otel` middleware was just auto-instrumenting Hono requests; Effect's tracing covers that automatically for all `Effect.gen` blocks. Hono request-level tracing can be re-added as a simple middleware that creates a span manually if needed. |
