# @chevrotain/core - Shared Core Package

## Overview

Shared utilities consumed by all apps: auth config, Effect services (database, analytics, billing, email), Drizzle schemas, ID generation, error types.

## Structure

```
src/
├── auth/
│   ├── index.ts           # better-auth configuration + user hooks
│   ├── auth.sql.ts        # Auth-related Drizzle tables
│   └── schema.ts          # Auth Effect Schema definitions
├── drizzle/
│   ├── index.ts           # Direct DB connection (used by better-auth)
│   ├── service.ts         # DatabaseService Layer (Effect-managed)
│   └── types.ts           # Drizzle type utilities
├── analytics/
│   ├── schema.ts          # AnalyticsEvent, ErrorReport (Effect Schema)
│   └── service.ts         # ClickHouseService Layer
├── billing/
│   ├── autumn.ts          # Direct Autumn client (used by better-auth hooks)
│   └── service.ts         # BillingService Layer
├── email/
│   └── service.ts         # EmailService Layer
├── errors.ts              # Tagged error classes (Effect Schema.TaggedErrorClass)
├── assert.ts              # Existence assertions (throwing + Effect-native)
├── id.ts                  # Prefixed ULID generation + validation
└── result.ts              # PublicError, Failure types (Effect Schema)
```

## Where to Look

| Task               | Location                                         |
| ------------------ | ------------------------------------------------ |
| Add DB table       | `{domain}/{domain}.sql.ts` + run migration       |
| Add ID prefix      | `id.ts` → add to `PREFIXES` object               |
| Add auth hook      | `auth/index.ts` → user hooks                     |
| Add error type     | `errors.ts` → add `TaggedErrorClass`             |
| Add domain schema  | `{domain}/schema.ts` using Effect Schema         |
| Add Effect service | `{domain}/service.ts` using `ServiceMap.Service` |

## Conventions

### Effect Services

All services follow the `ServiceMap.Service` + `Layer.effect` pattern:

```typescript
import { Config, Effect, Layer, ServiceMap } from "effect";

export interface MyServiceShape {
	readonly doWork: (input: string) => Effect.Effect<void, MyError>;
}

export class MyService extends ServiceMap.Service<MyService, MyServiceShape>()("MyService") {}

export const MyServiceLive = Layer.effect(MyService)(
	Effect.gen(function* () {
		const secret = yield* Config.redacted("MY_SECRET");
		// ... initialize client ...
		return {
			doWork: (input: string) =>
				Effect.tryPromise({
					try: () => client.doWork(input),
					catch: (cause) => new MyError({ message: "Failed", cause }),
				}),
		};
	}),
);
```

Services in this package:

| Service             | Layer                   | Purpose                           |
| ------------------- | ----------------------- | --------------------------------- |
| `DatabaseService`   | `DatabaseServiceLive`   | Effect-managed Drizzle + PgClient |
| `ClickHouseService` | `ClickHouseServiceLive` | Analytics event insertion         |
| `BillingService`    | `BillingServiceLive`    | Autumn billing operations         |
| `EmailService`      | `EmailServiceLive`      | Resend email sending              |

### Error Types

All errors use `Schema.TaggedErrorClass` with `httpApiStatus` annotations:

```typescript
import { Schema } from "effect";

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
	"NotFoundError",
	{
		resource: Schema.optional(Schema.String),
		message: Schema.optional(Schema.String),
	},
	{ httpApiStatus: 404 },
) {}
```

Available error types:

| Error               | Status | Purpose                   |
| ------------------- | ------ | ------------------------- |
| `NotFoundError`     | 404    | Missing resource          |
| `UnauthorizedError` | 401    | Missing/invalid auth      |
| `ForbiddenError`    | 403    | Insufficient permissions  |
| `ValidationError`   | 400    | Input validation failure  |
| `RateLimitError`    | 429    | Too many requests         |
| `DatabaseError`     | 500    | PostgreSQL failure        |
| `ClickHouseError`   | 500    | Analytics DB failure      |
| `EmailError`        | 500    | Email sending failure     |
| `BillingError`      | 500    | Billing operation failure |

### Effect Schema Validation

Use Effect Schema for all domain validation:

```typescript
import { Schema, SchemaGetter } from "effect";

const TrimmedNonEmptyString = Schema.String.pipe(
	Schema.decodeTo(Schema.NonEmptyString, {
		decode: SchemaGetter.transform((s: string) => s.trim()),
		encode: SchemaGetter.transform((s: string) => s),
	}),
);

export const User = Schema.Struct({
	id: Id,
	name: TrimmedNonEmptyString,
	email: TrimmedLowercaseEmail,
	emailVerified: Schema.Boolean.pipe(
		Schema.optional,
		Schema.withDecodingDefault(() => false),
	),
	createdAt: Schema.Date,
	updatedAt: Schema.Date,
});
export type User = typeof User.Type;
```

### ID Generation + Validation

Server-side ID generation for auth entities (domain entities get IDs from the client via Zero):

```typescript
import { Schema } from "effect";
import { ulid } from "ulid";

export const PREFIXES = {
	account: "acc",
	user: "usr",
	session: "ses",
	verification: "ver",
	jwks: "jwk",
} as const;

export function createId(prefix: IdPrefix): string {
	return [PREFIXES[prefix], ulid()].join("_");
}

// Validation schema — accepts any valid prefix_ULID format
export const Id = Schema.String.check(
	Schema.makeFilter((value: string) => {
		const parts = value.split("_");
		if (parts.length !== 2) return "a valid ID format (prefix_ULID)";
		const [prefix, id] = parts;
		if (!prefixValues.includes(prefix) || !ulidPattern.test(id)) {
			return "a valid ID format (prefix_ULID)";
		}
		return undefined;
	}),
);
```

### Assertions

Two assertion flavors — throwing (for Zero mutators) and Effect-native (for handlers):

```typescript
import { assert, assertFound } from "@chevrotain/core/assert";

// Throwing (Zero mutators, non-Effect code)
assert(bean); // Narrows T | null | undefined → T, throws PublicError 404

// Effect-native (handlers)
const bean = yield * assertFound(maybeBeanRow, "bean");
// Returns Effect<T, NotFoundError>
```

### PublicError

Legacy structured error type, still used by Zero mutators and `assert()`:

```typescript
throw new PublicError({ status: 403, global: [{ message: "Forbidden" }] });
throw new PublicError({
	status: 400,
	fields: [{ path: ["email"], message: "Invalid email" }],
});
```

### Table Definition Pattern

```typescript
export const user = pgTable("user", {
	id: char("id", { length: 30 }).primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at")
		.$onUpdate(() => new Date())
		.notNull(),
});
```

Key patterns:

- Use `char(30)` for ID columns (matches prefixed ULID format)
- Always add `userId` with cascade delete for user-owned entities
- Add indexes on foreign keys and query columns
- Use `.$onUpdate(() => new Date())` for `updatedAt`

### Database Access

Two database access paths exist:

1. **Effect-managed** (`DatabaseService` via `@effect/sql-pg`) — used by API handlers through the service layer
2. **Direct** (`db` from `drizzle/index.ts`) — used by better-auth (which is not Effect-aware)

### Auth Configuration

Better-auth in `auth/index.ts`:

```typescript
export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg", schema }),
	emailAndPassword: { enabled: true, minPasswordLength: 12 },
	plugins: [multiSession()],
	advanced: {
		database: {
			generateId: ({ model }) => createId(model as IdPrefix),
		},
	},
	userHooks: {
		afterCreate: async ({ user }) => {
			/* create Autumn customer */
		},
		afterUpdate: async ({ user }) => {
			/* update Autumn customer */
		},
	},
});
```

### Migrations

```bash
# From repo root
pnpm --filter @chevrotain/core exec drizzle-kit generate --name add_new_table
pnpm --filter @chevrotain/core exec drizzle-kit push  # Dev only
```

## Testing

```typescript
import { Option, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

describe("User schema", () => {
	it("normalizes input and defaults email verification", () => {
		const result = Schema.decodeUnknownOption(User)({
			id: createId("user"),
			name: "  Ada Lovelace  ",
			email: "ADA@Example.com",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		expect(Option.isSome(result)).toBe(true);
		if (Option.isSome(result)) {
			expect(result.value.name).toBe("Ada Lovelace");
			expect(result.value.email).toBe("ada@example.com");
		}
	});
});
```

## Database Tables

| Domain | Table          | Description               |
| ------ | -------------- | ------------------------- |
| Auth   | `user`         | User accounts             |
| Auth   | `session`      | Auth sessions             |
| Auth   | `account`      | OAuth/password accounts   |
| Auth   | `verification` | Email verification tokens |

## Anti-Patterns

| Never                              | Instead                                            |
| ---------------------------------- | -------------------------------------------------- |
| Raw SQL strings                    | Use Drizzle query builder                          |
| Missing `userId` on owned tables   | All user data needs user reference                 |
| Nullable required fields           | Use `.notNull()`                                   |
| `throw` in Effect code             | Use `yield* new TaggedError(...)` or `Effect.fail` |
| Manual `try/finally` for resources | Use `Effect.acquireRelease`                        |
| Generic `Error` classes            | Use `Schema.TaggedErrorClass`                      |
