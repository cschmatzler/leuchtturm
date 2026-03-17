# @chevrotain/zero - Zero Sync Layer

## Overview

@rocicorp/zero schema, mutators, and queries. Central data layer for local-first sync. Validation uses Effect Schema via `Schema.toStandardSchemaV1()`.

## Structure

```
src/
├── schema.ts           # Zero schema (tables + relationships)
├── queries.ts          # Preloadable query definitions
├── mutators.ts         # Aggregates all mutator groups
└── mutators/
    ├── shared.ts       # defineMutators, assertLoggedIn, assertOwnership, Tx type
    └── user.ts         # User mutators
```

## Key Files

### schema.ts

Defines synced tables with column mappings (snake_case DB -> camelCase JS):

```typescript
const user = table("user")
	.columns({
		id: string(),
		name: string(),
		email: string(),
		image: string().optional(),
		language: string().optional(),
		emailVerified: boolean().from("email_verified"),
	})
	.primaryKey("id");
```

Exports: `schema`, `zql`, row types (`UserRow`, etc.)

### mutators.ts

Aggregates all domain mutators:

```typescript
export const mutators = defineMutators({
	user: userMutators,
});
```

### queries.ts

Preloadable queries for Zero's `preload()`:

```typescript
export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),
});
```

## Conventions

### Mutator Pattern

All writes go through mutators with Effect Schema validation:

```typescript
import { Schema } from "effect";
import { defineMutator } from "@rocicorp/zero";

import { User } from "@chevrotain/core/auth/schema";
import { assertLoggedIn } from "@chevrotain/zero/mutators/shared";

export const userMutators = {
	update: defineMutator(
		Schema.toStandardSchemaV1(
			Schema.Struct({
				id: Schema.String,
				email: Schema.optional(User.fields.email),
				name: Schema.optional(User.fields.name),
				language: Schema.optional(Schema.String),
			}),
		),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			await tx.mutate.user.update({
				id: args.id,
				...args,
			});
		},
	),
};
```

Key points:

- Schemas use `Schema.toStandardSchemaV1()` to convert Effect Schema to the StandardSchema format expected by `defineMutator`
- Reference field schemas from `@chevrotain/core` (e.g., `User.fields.email`) for shared validation
- Use `Schema.optional()` for optional fields

### Adding a New Mutator Group

1. Create `mutators/{domain}.ts` with the mutator definitions
2. Import and add to `mutators.ts`:
   ```typescript
   export const mutators = defineMutators({
   	user: userMutators,
   	bean: beanMutators, // new
   });
   ```
3. Add the corresponding table to `schema.ts`

### Auth Pattern (MANDATORY)

Every mutator must:

1. Call `assertLoggedIn(ctx)` — throws 401 if no userId
2. Verify ownership via `assertOwnership(entity, ctx.userId)` — throws 403 if not owner

```typescript
import { assertLoggedIn, assertOwnership } from "@chevrotain/zero/mutators/shared";
import { zql } from "@chevrotain/zero/schema";

async ({ tx, ctx, args }) => {
	assertLoggedIn(ctx);

	const existing = await tx.run(zql.bean.where("id", args.id).one());
	assertOwnership(existing, ctx.userId);
	// ... perform mutation
};
```

### Column Mapping

DB uses snake_case, Zero uses camelCase. Use `.from("db_column")`:

```typescript
userId: string().from("user_id"),
emailVerified: boolean().from("email_verified"),
```

### Table Naming

Zero table name can differ from DB table:

```typescript
const inventoryCategory = table("inventoryCategory").from("inventory_category").columns({
	/* ... */
});
```

### Query Patterns

Single item queries use `.one()`:

```typescript
const user = await tx.run(zql.user.where("id", args.id).one());
```

List queries support filtering, relations, and ordering:

```typescript
zql.bean
	.where("userId", ctx?.userId ?? "")
	.related("brews", (q) => q.orderBy("brewedAt", "desc"))
	.orderBy("roastDate", "desc");
```

### Timestamps

Use Unix timestamps (milliseconds) for Zero:

```typescript
createdAt: Date.now(),
updatedAt: Date.now(),
```

## Type Exports

```typescript
export type UserRow = Row<typeof schema.tables.user>;

export type Schema = typeof schema;
export type Context = { userId: string };
export type Mutators = typeof mutators;

declare module "@rocicorp/zero" {
	interface DefaultTypes {
		schema: Schema;
		context: Context;
	}
}
```

## Package Exports

```json
{
	"exports": {
		"./*": "./src/*.ts"
	}
}
```

```typescript
import { schema, zql } from "@chevrotain/zero/schema";
import { queries } from "@chevrotain/zero/queries";
import { mutators } from "@chevrotain/zero/mutators";
import { assertLoggedIn, assertOwnership } from "@chevrotain/zero/mutators/shared";
import type { UserRow, Schema, Context } from "@chevrotain/zero/schema";
```

## Anti-Patterns

| Never                     | Instead                                          |
| ------------------------- | ------------------------------------------------ |
| Skip auth checks          | Always `assertLoggedIn` + ownership check        |
| Direct DB access          | Use `tx.mutate.*` or `tx.run(zql.*)`             |
| Missing validation schema | All mutators need Effect Schema input validation |
| Hardcoded user checks     | Use `ctx.userId` from context                    |
| Snake case in JS          | Map to camelCase with `.from()`                  |
| Date objects              | Use Unix timestamps (numbers)                    |

## Testing

Zero mutators can be tested by mocking the transaction:

```typescript
import { describe, it, expect, vi } from "vite-plus/test";

describe("user mutators", () => {
	it("should update user", async () => {
		const tx = {
			mutate: { user: { update: vi.fn() } },
		};
		const ctx = { userId: "usr_test123" };
		// ... test mutator logic
	});
});
```
