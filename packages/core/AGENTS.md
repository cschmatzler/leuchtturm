# @roasted/core - Shared Core Package

## Overview

Shared utilities consumed by all apps: auth config, Drizzle schemas, ID generation, error types, analytics, billing integration.

## Structure

```
src/
├── auth/
│   ├── index.ts           # better-auth configuration + Autumn hooks
│   ├── auth.sql.ts        # Auth-related Drizzle tables
│   ├── schema.ts          # Auth Zod schemas
│   └── queries.ts         # Auth queries (device sessions)
├── drizzle/
│   ├── index.ts           # DB connection export
│   └── types.ts           # Drizzle type utilities
├── brewing/
│   ├── brewing.sql.ts     # Brewing domain tables (brews, methods, custom fields)
│   └── schema.ts          # Brewing arktype schemas
├── dialing/
│   ├── dialing.sql.ts     # Dialing/suggestion tables
│   └── suggestions.ts     # AI suggestion generation (OpenAI)
├── inventory/
│   ├── inventory.sql.ts   # Inventory tables (beans, grinders)
│   └── schema.ts          # Inventory arktype schemas
├── billing/
│   └── schema.ts          # Billing types + Autumn integration
├── analytics/
│   └── index.ts           # Analytics events + ClickHouse client
├── assert.ts              # Existence assertion (narrows T | null | undefined → T)
├── id.ts                  # Prefixed ULID generation + validation
└── result.ts              # PublicError, HTTPResponse types
```

## Where to Look

| Task                | Location                                   |
| ------------------- | ------------------------------------------ |
| Add DB table        | `{domain}/{domain}.sql.ts` + run migration |
| Add ID prefix       | `id.ts` → add to `PREFIXES` object         |
| Add auth hook       | `auth/index.ts` → organization/user hooks  |
| Add error type      | `result.ts`                                |
| Add domain schema   | `{domain}/schema.ts`                       |
| Add analytics event | `analytics/index.ts`                       |
| Add AI suggestion   | `dialing/suggestions.ts`                   |

## Conventions

### Table Definition Pattern

```typescript
// brewing/brewing.sql.ts
export const brew = pgTable(
	"brew",
	{
		id: char("id", { length: 30 }).primaryKey(),
		userId: char("user_id", { length: 30 })
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		beanId: char("bean_id", { length: 30 })
			.notNull()
			.references(() => bean.id, { onDelete: "cascade" }),
		brewedAt: timestamp("brewed_at").notNull(),
		createdAt: timestamp("created_at").notNull(),
		updatedAt: timestamp("updated_at")
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("brew_user_id_idx").on(table.userId),
		index("brew_bean_id_idx").on(table.beanId),
	],
);
```

Key patterns:

- Use `char(30)` for ID columns (matches prefixed ULID format)
- Always add `userId` with cascade delete
- Add indexes on foreign keys and query columns
- Use `.$onUpdate(() => new Date())` for `updatedAt`
- Set `notNull()` on required fields

### ID Prefixes

All entities use prefixed ULIDs:

```typescript
// id.ts
export const PREFIXES = {
	user: "usr",
	bean: "bea",
	brew: "bre",
	method: "met",
	grinder: "gri",
	customField: "cus",
	customFieldScope: "csc",
	customFieldOption: "cso",
	customFieldValue: "cvl",
	methodCustomFieldDefault: "mcd",
	methodBrewDefault: "mbd",
	dialingSession: "dia",
	suggestion: "sug",
	suggestionAdjustment: "sad",
	organization: "org",
	session: "ses",
	account: "acc",
	verification: "ver",
	invitation: "inv",
	member: "mem",
} as const;

export type IdPrefix = keyof typeof PREFIXES;

export function createId(prefix: IdPrefix): string {
	return [PREFIXES[prefix], ulid()].join("_");
}
```

### ID Validation (arktype)

```typescript
// id.ts
export const Id = type("string").narrow((value, ctx) => {
	const parts = value.split("_");
	if (parts.length !== 2) {
		return ctx.mustBe("a valid ID format (prefix_ULID)");
	}
	const [prefix, id] = parts;
	if (!Object.values(PREFIXES).includes(prefix as PrefixValue) || !/^[0-9A-Z]{26}$/.test(id)) {
		return ctx.mustBe("a valid ID format (prefix_ULID)");
	}
	return true;
});
```

### Auth Configuration

Better-auth setup in `auth/index.ts`:

```typescript
export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "pg" }),
	plugins: [
		organization({
			hooks: {
				afterCreateOrganization: async ({ organization }) => {
					// Create Autumn customer
				},
				beforeCreateInvitation: async ({ organizationId }) => {
					// Check Pro plan limits
				},
			},
		}),
		multiSession(),
	],
	// ...
});
```

### Auth Hooks (Billing Integration)

Autumn billing integration in organization hooks:

- `afterCreateOrganization`: Create Autumn customer
- `beforeCreateInvitation`: Check Pro plan limits
- `afterCreateInvitation`: Track seat usage

### Domain Schemas (arktype)

Use arktype for domain validation:

```typescript
// brewing/schema.ts
import { type } from "arktype";

export const CustomFieldType = type("'boolean' | 'select' | 'number' | 'text' | 'textarea'");
export type CustomFieldType = typeof CustomFieldType.infer;

export const BrewParams = type({
	doseGrams: "number > 0",
	grindSize: "number > 0",
	waterTemperatureC: "number >= 0",
	timeSeconds: "number > 0",
	yield: "number > 0",
	"notes?": "string",
	"rating?": "number >= 0",
	"flavorWheel?": "string",
});
export type BrewParams = typeof BrewParams.infer;
```

### Assertions

```typescript
import { assert } from "@roasted/core/assert";

const [bean] = await db.select().from(beanTable).where(eq(beanTable.id, id)).limit(1);
assert(bean); // Narrows T | null | undefined → T, throws PublicError 404
```

Use `assert()` to validate that expected data exists. Throws `PublicError({ status: 404 })` on `null` or `undefined`.

### PublicError

Structured error type for API responses:

```typescript
export class PublicError extends Error {
	status?: number;
	global: GlobalError[];
	fields: FieldError[];

	constructor(options: {
		status?: number;
		global?: { code?: string; message: string }[];
		fields?: { code?: string; message: string; path: (string | number)[] }[];
	}) {
		super();
		this.status = options.status;
		this.global = options.global || [];
		this.fields = options.fields || [];
	}
}
```

HTTP response format:

```typescript
{
	success: false,
	error: {
		global: [{ code?: string; message: string }],
		fields: [{ code?: string; message: string; path: (string | number)[] }]
	}
}
```

### Migrations

Generate and run migrations:

```bash
# From repo root
pnpm --filter @roasted/core exec drizzle-kit generate --name add_new_table
pnpm --filter @roasted/core exec drizzle-kit push  # Dev only
```

Migration files go in `drizzle/` directory and are applied via deploy script in production.

### Database Connection

Drizzle client exported from `drizzle/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);
```

### Analytics Events

Analytics event definitions in `analytics/index.ts`:

```typescript
export const AnalyticsEvent = type({
	event: "string",
	properties: "object",
	timestamp: "string",
});
```

ClickHouse integration for high-volume event storage:

- Uses `JSONEachRow` format for bulk inserts
- Batched inserts via `analyticsClient` singleton
- Automatic timestamp generation

### AI Suggestions

OpenAI integration in `dialing/suggestions.ts`:

```typescript
export async function generateSuggestion(
	userId: string,
	dialingSessionId: string,
	brewId: string,
): Promise<SuggestionParams> {
	// 1. Fetch dialing session + brews
	// 2. Build prompt from brew history
	// 3. Call OpenAI API
	// 4. Parse JSON response
	// 5. Return structured suggestion
}
```

## Anti-Patterns

| Never                             | Why                                |
| --------------------------------- | ---------------------------------- |
| Raw SQL strings                   | Use Drizzle query builder          |
| Missing `userId`                  | All user data needs user reference |
| Nullable required fields          | Use `.notNull()`                   |
| Verbose null checks for existence | Use `assert()`                     |
| Hardcoded table names             | Import from schema files           |
| Missing indexes on FKs            | Always index foreign keys          |
| `varchar` without length          | Use `char(30)` for IDs             |

## Testing

Core tests use vitest:

```typescript
import { describe, it, expect } from "vite-plus/test";
import { createId, Id, PREFIXES } from "@roasted/core/id";

describe("createId", () => {
	it("returns expected prefix and ULID", () => {
		const id = createId("user");
		expect(id.startsWith(`${PREFIXES.user}_`)).toBe(true);
	});
});
```

Run tests from repo root: `vp test packages/core/src/id.test.ts`

## Type Exports

All imports use absolute package paths (no relative imports allowed):

```typescript
// In apps/web or apps/api:
import { createId } from "@roasted/core/id";
import { PublicError } from "@roasted/core/result";
import { assert } from "@roasted/core/assert";
import type { User, Session } from "@roasted/core/auth/schema";
import { BrewParams, CustomFieldType } from "@roasted/core/brewing/schema";
import { Bean } from "@roasted/core/inventory/schema";
```

## Database Tables (Complete Reference)

| Domain    | Table                         | Description                        |
| --------- | ----------------------------- | ---------------------------------- |
| Auth      | `user`                        | User accounts                      |
| Auth      | `session`                     | Auth sessions                      |
| Auth      | `account`                     | OAuth accounts                     |
| Auth      | `verification`                | Email verification tokens          |
| Auth      | `organization`                | Organizations                      |
| Auth      | `invitation`                  | Org invitations                    |
| Auth      | `member`                      | Org memberships                    |
| Inventory | `bean`                        | Coffee beans inventory             |
| Inventory | `grinder`                     | Grinder equipment                  |
| Brewing   | `method`                      | Brew methods (pourover, immersion) |
| Brewing   | `brew`                        | Individual brew records            |
| Brewing   | `custom_field`                | Custom brew logging fields         |
| Brewing   | `custom_field_scope`          | Field scope per method type        |
| Brewing   | `custom_field_option`         | Options for select fields          |
| Brewing   | `custom_field_value`          | Actual field values on brews       |
| Brewing   | `method_custom_field_default` | Default field values per method    |
| Brewing   | `method_brew_default`         | Default brew parameters per method |
| Dialing   | `dialing_session`             | Method dialing sessions            |
| Dialing   | `suggestion`                  | AI suggestions                     |
| Dialing   | `suggestion_adjustment`       | Suggestion parameter adjustments   |

## Exports Summary

```typescript
// id.ts
export { createId, PREFIXES, Id };
export type { IdPrefix };

// result.ts
export { PublicError, HTTPResponse };

// assert.ts
export { assert };

// drizzle/index.ts
export { db };

// auth/index.ts
export { auth };
export type { Session, User, Organization, Member, Invitation };

// {domain}/schema.ts
export { SchemaName, SchemaName2 };
export type { SchemaNameInfer };
```
