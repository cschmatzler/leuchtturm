# @roasted/zero - Zero Sync Layer

## Overview

@rocicorp/zero schema, mutators, and queries. Central data layer for local-first sync.

## Structure

```
src/
├── schema.ts           # Zero schema (tables + relationships)
├── queries.ts          # Preloadable query definitions
├── mutators.ts         # Aggregates all mutator groups
└── mutators/
    ├── shared.ts       # defineMutators, assertLoggedIn, assertOwnership
    ├── user.ts         # User mutators
    ├── bean.ts         # Bean mutators
    ├── brew.ts         # Brew mutators
    ├── method.ts       # Method mutators
    ├── grinder.ts      # Grinder mutators
    ├── custom-field.ts # Custom field mutators
    ├── custom-field-option.ts
    ├── method-custom-field-default.ts
    ├── method-brew-default.ts
    └── dialing-session.ts
```

## Key Files

### schema.ts

Defines all synced tables with column mappings (snake_case DB → camelCase JS):

```typescript
const bean = table("bean")
	.columns({
		id: string(),
		name: string(),
		userId: string().from("user_id"),
		roaster: string(),
		roastDate: number().from("roast_date"),
		// ...
	})
	.primaryKey("id");
```

Exports: `schema`, `zql`, row types (`BeanRow`, `BrewRow`, etc.)

### mutators.ts

Aggregates all domain mutators:

```typescript
export const mutators = defineMutators({
	user: userMutators,
	grinder: grinderMutators,
	method: methodMutators,
	bean: beanMutators,
	brew: brewMutators,
	customField: customFieldMutators,
	customFieldOption: customFieldOptionMutators,
	methodCustomFieldDefault: methodCustomFieldDefaultMutators,
	methodBrewDefault: methodBrewDefaultMutators,
	dialingSession: dialingSessionMutators,
});
```

### queries.ts

Preloadable queries for Zero's `preload()`:

```typescript
export const queries = defineQueries({
	currentUser: defineQuery(({ ctx }) => zql.user.where("id", ctx?.userId ?? "").one()),

	beans: defineQuery(({ ctx }) =>
		zql.bean
			.where("userId", ctx?.userId ?? "")
			.related("brews")
			.orderBy("roastDate", "desc"),
	),

	brews: defineQuery(({ ctx }) =>
		zql.brew
			.where("userId", ctx?.userId ?? "")
			.related("bean")
			.related("method")
			.orderBy("brewedAt", "desc"),
	),
});
```

## Conventions

### Mutator Pattern

All writes go through mutators defined with arktype validation:

```typescript
import { defineMutator } from "@rocicorp/zero";
import { type } from "arktype";
import { Bean } from "@roasted/core/inventory/schema";
import { assertLoggedIn, assertOwnership } from "@roasted/zero/mutators/shared";
import { zql } from "@roasted/zero/schema";

export const beanMutators = {
	create: defineMutator(
		type({
			id: "string",
			name: Bean.get("name"),
			"roaster?": Bean.get("roaster").or("undefined"),
		}),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			await tx.mutate.bean.insert({
				...args,
				userId: ctx.userId,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			});
		},
	),

	update: defineMutator(
		type({ id: "string", "name?": Bean.get("name") }),
		async ({ tx, ctx, args }) => {
			assertLoggedIn(ctx);

			const existing = await tx.run(zql.bean.where("id", args.id).one());
			assertOwnership(existing, ctx.userId);

			await tx.mutate.bean.update({
				id: args.id,
				name: args.name,
				updatedAt: Date.now(),
			});
		},
	),

	delete: defineMutator(type({ id: "string" }), async ({ tx, ctx, args }) => {
		assertLoggedIn(ctx);

		const existing = await tx.run(zql.bean.where("id", args.id).one());
		assertOwnership(existing, ctx.userId);

		await tx.mutate.bean.delete({ id: args.id });
	}),
};
```

### Auth Pattern (MANDATORY)

Every mutator must:

1. Call `assertLoggedIn(ctx)`
2. Verify ownership via `assertOwnership(entity, ctx.userId)`
3. Throw `PublicError({ status: 403 })` if unauthorized

```typescript
import { assertLoggedIn, assertOwnership } from "@roasted/zero/mutators/shared";
import { zql } from "@roasted/zero/schema";

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
roastDate: number().from("roast_date"),
remainingGrams: number().from("remaining_grams"),
```

### Table Naming

Zero table name can differ from DB table:

```typescript
const inventoryCategory = table("inventoryCategory")
	.from("inventory_category") // DB table name
	.columns({
		/* ... */
	});
```

### Query Patterns

Single item queries use `.one()`:

```typescript
const bean = await tx.run(zql.bean.where("id", args.id).one());
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

## Tables (Complete Reference)

| Zero Table                 | DB Table                      | Columns | Purpose                |
| -------------------------- | ----------------------------- | ------- | ---------------------- |
| `user`                     | `user`                        | 6       | User accounts          |
| `bean`                     | `bean`                        | 15      | Coffee bean inventory  |
| `brew`                     | `brew`                        | 16      | Brew records           |
| `grinder`                  | `grinder`                     | 6       | Grinder equipment      |
| `method`                   | `method`                      | 7       | Brew methods           |
| `customField`              | `custom_field`                | 8       | Custom brew fields     |
| `customFieldScope`         | `custom_field_scope`          | 5       | Field scope per method |
| `customFieldOption`        | `custom_field_option`         | 4       | Select field options   |
| `customFieldValue`         | `custom_field_value`          | 8       | Field values on brews  |
| `methodCustomFieldDefault` | `method_custom_field_default` | 8       | Default field values   |
| `methodBrewDefault`        | `method_brew_default`         | 9       | Default brew params    |
| `dialingSession`           | `dialing_session`             | 8       | Dialing sessions       |
| `suggestion`               | `suggestion`                  | 6       | AI suggestions         |
| `suggestionAdjustment`     | `suggestion_adjustment`       | 7       | Suggestion adjustments |

## Relationships

```typescript
// User (root) - all owned entities
user -> [grinders, methods, beans, brews, customFields, ...]

// Bean
bean -> user (one)
bean -> brews (many)

// Brew (most connected)
brew -> user, bean, method, grinder, dialingSession (one each)
brew -> customFieldValues (many)

// Method
method -> user (one)
method -> brews, customFieldDefaults (many)
method -> brewDefault (one)

// Grinder
grinder -> user (one)
grinder -> brews, methodDefaults (many)

// CustomField
customField -> user (one)
customField -> options, scopes, values, defaults (many)

// DialingSession
dialingSession -> user, bean, method (one each)
dialingSession -> brews, suggestions (many)

// Suggestion
suggestion -> user, dialingSession, brew (one each)
suggestion -> adjustments (many)
```

## Queries (Complete Reference)

| Query                       | Type                          | Auth Filter                     | Relations                                | Returns                        |
| --------------------------- | ----------------------------- | ------------------------------- | ---------------------------------------- | ------------------------------ |
| `currentUser`               | One                           | id → userId                     | —                                        | Single user                    |
| `grinders`                  | List                          | userId                          | —                                        | All user grinders              |
| `methods`                   | List                          | userId                          | —                                        | All user methods               |
| `methodsWithDefaults`       | List                          | userId                          | brewDefault, customFieldDefaults         | Methods + defaults             |
| `beans`                     | List                          | userId                          | brews                                    | All user beans + related brews |
| `bean`                      | One (args: id)                | userId + id match               | brews                                    | Single bean with brews         |
| `customFields`              | List                          | userId                          | options, scopes                          | Custom fields + options        |
| `methodCustomFieldDefaults` | List (args: methodId)         | userId + methodId               | customField                              | Defaults for method            |
| `methodBrewDefault`         | One (args: methodId)          | userId + methodId               | —                                        | Single default set             |
| `brews`                     | List                          | userId                          | bean, method, grinder, customFieldValues | All brews + relations          |
| `brew`                      | One (args: id)                | userId + id match               | bean, method, grinder, customFieldValues | Single brew + relations        |
| `activeDialingSession`      | One (args: beanId)            | userId + beanId + status=active | bean, method                             | Active session for bean        |
| `dialingSession`            | One (args: id)                | userId + id match               | bean, method                             | Single session                 |
| `dialingSessionBrews`       | List (args: dialingSessionId) | dialingSessionId + userId       | method, grinder                          | Brews in session               |
| `dialingSessionSuggestions` | List (args: dialingSessionId) | dialingSessionId + userId       | adjustments                              | Session suggestions            |
| `beanDialingSessions`       | List (args: beanId)           | beanId + userId                 | method                                   | All sessions for bean          |

## Mutators (Complete Reference)

### shared.ts

- `defineMutators` — typed mutator aggregator
- `Tx` — typed transaction type
- `assertLoggedIn(ctx)` — throws 401 if no userId
- `assertOwnership(entity, userId)` — throws 403 if not owner

### user.ts

- `update` — update user profile (email, name, language)

### bean.ts

- `create` — create bean, sets remainingGrams = weightGrams
- `update` — update bean fields
- `archive` — toggle archived flag

### grinder.ts

- `create` — create grinder
- `update` — update name
- `archive` — toggle archived

### method.ts

- `create` — create method with name + type
- `update` — update name and/or type
- `archive` — toggle archived

### custom-field.ts

- `create` — create field with type, create scopes for methodTypes
- `update` — update field properties + synchronize methodTypes

### custom-field-option.ts

- `create` — create option for select field
- `update` — update label and/or sortOrder
- `delete` — delete option with cascade cleanup (values, defaults)

### method-custom-field-default.ts

- `upsert` — create or update default, validates field scope
- `delete` — remove default

### method-brew-default.ts

- `upsert` — set default brew parameters
- `delete` — remove defaults

### brew.ts (Most Complex)

- `create` — create brew + custom field values, decrement bean inventory
- `update` — update brew + custom field values, adjust inventory
- `delete` — delete brew, refund bean inventory
- Helpers: `validateFieldAndScope`, `validateSelectOption`, `shouldDeleteFieldValue`, `createFieldValuePayload`

### dialing-session.ts

- `create` — start new session, validate bean + method
- `complete` — mark session complete
- `delete` — cancel session

## Advanced Patterns

### Field Value Handling (brew.ts)

Null/undefined handling for custom fields:

```typescript
function shouldDeleteFieldValue(fieldType: CustomFieldType, value: unknown) {
	if (fieldType === "boolean" || fieldType === "select") {
		return value === null; // Only null deletes
	}
	return value === null || value === ""; // Both delete for text
}
```

- `null` → delete existing value
- `undefined` → skip (leave unchanged)
- `""` → delete for text, skip for boolean/select
- Actual value → insert or upsert

### Caching Pattern (brew.ts)

```typescript
const fieldScopeCache = new Map<string, string[]>();

for (const value of fieldValues) {
	const field = await validateFieldAndScope(
		tx,
		value.customFieldId,
		ctx.userId,
		methodRow.type,
		fieldScopeCache, // Reused across iterations
	);
}
```

Prevents N+1 queries when validating multiple fields.

### Inventory Management (brew.ts)

```typescript
// Create: subtract dose
remainingGrams: (bean.remainingGrams ?? 0) - args.doseGrams;

// Update: adjust by difference
const doseDiff = args.doseGrams - existing.doseGrams;
const newRemaining = (bean.remainingGrams ?? 0) - doseDiff;

// Delete: refund full dose
remainingGrams: (bean.remainingGrams ?? 0) + existing.doseGrams;
```

### Cascading Deletes (custom-field-option.ts)

```typescript
// 1. Clean up references in customFieldValues
const values = await tx.run(
	zql.customFieldValue.where("customFieldId", id).where("value", optionId),
);
for (const v of values) {
	await tx.mutate.customFieldValue.delete({ id: v.id });
}

// 2. Clean up references in methodCustomFieldDefaults
// 3. Finally delete the option itself
```

### Scope Synchronization (custom-field.ts)

```typescript
// Compute exact-match set of method scopes
const uniqueMethods = Array.from(new Set(methodTypes));
const existingScopes = await tx.run(zql.customFieldScope.where("customFieldId", id));

// Remove scopes not in new list
// Add scopes for new method types
// Final state is exactly uniqueMethods
```

## Anti-Patterns

| Never                  | Instead                                   |
| ---------------------- | ----------------------------------------- |
| Skip auth checks       | Always `assertLoggedIn` + ownership check |
| Direct DB access       | Use `tx.mutate.*` or `tx.run(zql.*)`      |
| Missing arktype schema | All mutators need input validation        |
| Hardcoded user checks  | Use `ctx.userId` from context             |
| Snake case in JS       | Map to camelCase with `.from()`           |
| Date objects           | Use Unix timestamps (numbers)             |

## Testing

Zero mutators are tested through integration with the web app. Unit tests can mock the transaction:

```typescript
import { describe, it, expect, vi } from "vite-plus/test";

describe("bean mutators", () => {
	it("should create bean with userId", async () => {
		const tx = {
			mutate: { bean: { insert: vi.fn() } },
		};
		const ctx = { userId: "usr_test123" };
		// ... test mutator logic
	});
});
```

## Type Exports

Export row types from schema for use in web components:

```typescript
export type UserRow = Row<typeof schema.tables.user>;
export type BeanRow = Row<typeof schema.tables.bean>;
export type BrewRow = Row<typeof schema.tables.brew>;
// ... all 14 row types

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

Enables:

```typescript
import { schema, zql } from "@roasted/zero/schema";
import { queries } from "@roasted/zero/queries";
import { mutators } from "@roasted/zero/mutators";
import { assertLoggedIn, assertOwnership } from "@roasted/zero/mutators/shared";
import type { BeanRow, Schema, Context } from "@roasted/zero/schema";
```
