# Migration Plan: ArkType → Effect/Schema

Replace all ArkType usage with `effect/Schema`, leveraging Standard Schema for TanStack Form, TanStack Router, and @rocicorp/zero integration.

## Current State

- **ArkType 2.2.0** in 4 packages: `core`, `zero`, `api`, `web`
- **Effect 4.0.0-beta.33** already in `core` and `api` (services, runtime, errors)
- **15 files** import from `"arktype"`
- Both ArkType and Effect/Schema implement Standard Schema — TanStack Form, TanStack Router `validateSearch`, and `@rocicorp/zero` `defineMutator` all accept Standard Schema validators

## Import Convention

```typescript
import { Schema } from "effect";
```

Wrap schemas with `Schema.standardSchemaV1()` where Standard Schema interface is needed (TanStack Form validators, TanStack Router `validateSearch`, Zero `defineMutator`).

## Type Inference Convention

```typescript
// ArkType
export type User = typeof User.infer;

// Effect/Schema
export type User = typeof User.Type;
```

## Migration Order

Work bottom-up through the dependency graph. Each phase must pass `vp lint --type-aware --type-check` and `vp test` before moving on.

---

### Phase 1: `packages/core` — Foundation Schemas

These are the leaf schemas that everything else depends on.

#### 1.1 `packages/core/src/id.ts`

ArkType `type("string").narrow()` → `Schema.String.pipe(Schema.filter())`.

```typescript
// Before
export const Id = type("string").narrow((value, ctx) => {
	const parts = value.split("_");
	if (parts.length !== 2) return ctx.mustBe("a valid ID format (prefix_ULID)");
	const [prefix, id] = parts;
	if (!Object.values(PREFIXES).includes(prefix as PrefixValue) || !/^[0-9A-Z]{26}$/.test(id))
		return ctx.mustBe("a valid ID format (prefix_ULID)");
	return true;
});

// After
export const Id = Schema.String.pipe(
	Schema.filter((value) => {
		const parts = value.split("_");
		if (parts.length !== 2) return "a valid ID format (prefix_ULID)";
		const [prefix, id] = parts;
		if (!Object.values(PREFIXES).includes(prefix as PrefixValue) || !/^[0-9A-Z]{26}$/.test(id))
			return "a valid ID format (prefix_ULID)";
		return true;
	}),
);
```

#### 1.2 `packages/core/src/id.test.ts`

Replace `Id(value)` callable pattern with `Schema.decodeUnknownEither(Id)(value)`, and `instanceof type.errors` with `Either.isLeft()`.

```typescript
// Before
const result = Id(`${PREFIXES.user}_${id}`);
expect(result instanceof type.errors).toBe(false);

// After
import { Either } from "effect";
const result = Schema.decodeUnknownEither(Id)(`${PREFIXES.user}_${id}`);
expect(Either.isRight(result)).toBe(true);
```

#### 1.3 `packages/core/src/auth/schema.ts`

Key mappings:

| ArkType                                                    | Effect/Schema                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `type({ ... })`                                            | `Schema.Struct({ ... })`                                                                                                    |
| `type("string").pipe((s) => s.trim(), type("string > 0"))` | `Schema.transform(Schema.String, Schema.NonEmptyString, { strict: true, decode: (s) => s.trim(), encode: (s) => s })`       |
| `type("string.email")`                                     | `Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))`                                                          |
| `.pipe((s) => s.trim().toLowerCase())` on email            | `Schema.transform(EmailString, NormalizedEmail, { strict: true, decode: (s) => s.trim().toLowerCase(), encode: (s) => s })` |
| `"string \| null"`                                         | `Schema.NullOr(Schema.String)`                                                                                              |
| `"Date"`                                                   | `Schema.DateFromSelf`                                                                                                       |
| `type("boolean").default(() => false)`                     | `Schema.optional(Schema.Boolean, { default: () => false })`                                                                 |
| `"field?"` optional key                                    | `Schema.optional(SchemaType)` or `Schema.optionalWith(SchemaType, { as: "Option" })`                                        |
| `"string > 12 \| null"`                                    | `Schema.NullOr(Schema.String.pipe(Schema.minLength(13)))`                                                                   |
| `.describe("...")`                                         | `Schema.annotations({ description: "..." })` or `.annotations({ message: () => "..." })`                                    |
| `typeof User.infer`                                        | `typeof User.Type`                                                                                                          |

#### 1.4 `packages/core/src/auth/schema.test.ts`

Replace callable schema `User({...})` with `Schema.decodeUnknownEither(User)({...})`.
Replace `instanceof type.errors` with `Either.isLeft()` / `Either.isRight()`.

#### 1.5 `packages/core/src/result.ts`

Straightforward struct replacement. `GlobalError`, `FieldError`, `Failure` become `Schema.Struct(...)`.

`"(string | number)[]"` → `Schema.Array(Schema.Union(Schema.String, Schema.Number))`

#### 1.6 `packages/core/src/analytics/schema.ts`

Same patterns as auth/schema.ts:

- `.pipe((s) => s.trim(), type("string > 0"))` → `Schema.transform` with trim + `Schema.NonEmptyString`
- `.array()` → `Schema.Array(SomeSchema)`
- `"Record<string, unknown>"` → `Schema.Record({ key: Schema.String, value: Schema.Unknown })`

---

### Phase 2: `packages/core` — Add `effect` dependency to `apps/web`

Effect is currently only in `core` and `api`. Since `apps/web` will now use `Schema.standardSchemaV1()` wrappers, add `"effect"` to `apps/web/package.json` dependencies (same version: `4.0.0-beta.33`).

Also add it to `packages/zero/package.json` if not already present.

Run `vp install` and `nu scripts/update-pnpm-hash.nu` after.

---

### Phase 3: `packages/zero` — Mutator Schemas

#### 3.1 `packages/zero/src/mutators/user.ts` (and all other mutator files)

The `defineMutator` first argument needs a Standard Schema object. Wrap with `Schema.standardSchemaV1()`.

Schema composition changes:

- `User.get("email")` → `User.fields.email`
- `User.get("language").exclude("null")` → extract the non-null member from the `NullOr` union, or define a separate non-null schema

```typescript
// Before
defineMutator(
	type({
		id: "string",
		"email?": User.get("email"),
		"name?": User.get("name"),
		"language?": User.get("language").exclude("null"),
	}),
	async ({ tx, ctx, args }) => { ... },
)

// After
defineMutator(
	Schema.standardSchemaV1(
		Schema.Struct({
			id: Schema.String,
			email: Schema.optional(User.fields.email),
			name: Schema.optional(User.fields.name),
			language: Schema.optional(/* non-null variant of User.fields.language */),
		}),
	),
	async ({ tx, ctx, args }) => { ... },
)
```

Repeat for all mutator files: `bean.ts`, `brew.ts`, `method.ts`, `grinder.ts`, `custom-field.ts`, `custom-field-option.ts`, `method-custom-field-default.ts`, `method-brew-default.ts`, `dialing-session.ts`.

---

### Phase 4: `apps/web` — Form Validators & Route Search Schemas

#### 4.1 Form components (login, signup, reset-password, forgot-password, profile-card)

Per-field validation with TanStack Form uses `.get("field")`. Replace with `.fields.fieldName` and wrap with `Schema.standardSchemaV1()`.

```typescript
// Before
const shape = type({
	email: User.get("email"),
	password: Account.get("password").exclude("null"),
});

// Per-field validator
validators={{ onChange: shape.get("email") }}

// Type inference
const onSubmit = async (value: typeof shape.infer) => { ... };

// After
const shape = Schema.Struct({
	email: User.fields.email,
	password: /* non-null variant of Account.fields.password */,
});

// Per-field validator
validators={{ onChange: Schema.standardSchemaV1(shape.fields.email) }}

// Type inference
const onSubmit = async (value: typeof shape.Type) => { ... };
```

Files:

- `apps/web/src/pages/login.tsx`
- `apps/web/src/pages/signup.tsx`
- `apps/web/src/pages/reset-password/-components/reset-password-form.tsx`
- `apps/web/src/pages/forgot-password/-components/forgot-password-form.tsx`
- `apps/web/src/pages/app.settings.preferences/-components/profile-card.tsx`

#### 4.2 Route search param schemas

```typescript
// Before
const searchSchema = type({ token: "string" });
export const Route = createFileRoute("/reset-password")({
	validateSearch: searchSchema,
});

// After
const searchSchema = Schema.standardSchemaV1(Schema.Struct({ token: Schema.String }));
export const Route = createFileRoute("/reset-password")({
	validateSearch: searchSchema,
});
```

Files:

- `apps/web/src/pages/reset-password.tsx`
- `apps/web/src/pages/app.settings.billing.tsx`

#### 4.3 `apps/web/src/lib/search-params.ts`

Replace `filterModelSchema` and `filtersStateSchema` with Effect/Schema equivalents.

```typescript
// Before
const filterModelSchema = type({
	columnId: "string",
	type: "'text' | 'number' | 'date' | 'option' | 'multiOption'",
	operator: "string",
	values: "unknown[]",
});
export const filtersStateSchema = filterModelSchema.array().default(() => []);

// After
const filterModelSchema = Schema.Struct({
	columnId: Schema.String,
	type: Schema.Literal("text", "number", "date", "option", "multiOption"),
	operator: Schema.String,
	values: Schema.Array(Schema.Unknown),
});
export const filtersStateSchema = Schema.standardSchemaV1(
	Schema.optional(Schema.Array(filterModelSchema), { default: () => [] }),
);
```

---

### Phase 5: Remove ArkType

1. Remove `"arktype": "2.2.0"` from all four `package.json` files
2. Run `vp install`
3. Run `nu scripts/update-pnpm-hash.nu`
4. Verify no remaining `arktype` imports: `grep -r "arktype" --include="*.ts" --include="*.tsx"`

---

### Phase 6: Update AGENTS.md Files

Update all documentation that references ArkType:

- `AGENTS.md` (root) — update code examples
- `packages/core/AGENTS.md` — update schema examples
- `packages/zero/AGENTS.md` — update mutator examples
- `apps/web/AGENTS.md` — update form validation examples

---

### Phase 7: Verify

1. `vp lint --type-aware --type-check` — no errors
2. `vp test` — all tests pass
3. `treefmt` — all files formatted
4. `grep -r "arktype" .` — zero results (excluding this plan file)

---

## Effect Runtime Integration Notes

Per the "full Effect integration where possible" decision:

- In `packages/core` and `apps/api` (which already run Effect runtime), prefer `Schema.decodeUnknown` (returns `Effect<A, ParseError>`) for validation within Effect pipelines rather than sync decode-or-throw
- In `apps/web` (React, no Effect runtime), use `Schema.standardSchemaV1()` for Standard Schema integration and `Schema.decodeUnknownSync()` / `Schema.decodeUnknownEither()` for any explicit validation calls
- In `packages/zero` (runs in both client and server contexts), use `Schema.standardSchemaV1()` for `defineMutator` input schemas

## Key Gotchas

1. **No callable schemas** — Effect schemas are not callable like ArkType. Any code that calls a schema as `Schema(value)` must change to use `Schema.decodeUnknownSync(schema)(value)` or the Either/Effect variants.

2. **`.get("field")` → `.fields.field`** — Effect Struct schemas expose fields via `.fields` property, not a `.get()` method.

3. **`.exclude("null")`** — No direct equivalent. For `NullOr(X)`, either access the non-null member or define the base schema separately and compose both nullable and non-nullable variants as needed.

4. **`.pipe()` transforms** — ArkType's `.pipe(fn, validator)` becomes `Schema.transform(From, To, { decode, encode })`. Remember transforms need both `decode` and `encode` directions.

5. **Optional fields** — ArkType uses `"field?": type` syntax. Effect uses `Schema.optional(type)` within a Struct.

6. **`standardSchemaV1` wrapping** — Must wrap Effect schemas with `Schema.standardSchemaV1()` at the boundary where they're consumed by TanStack Form, TanStack Router, and Zero. This can be done at the call site or when exporting the schema.

7. **Test assertions** — All tests using `instanceof type.errors` need rewriting to use `Either.isLeft()` / `Either.isRight()` or try/catch with `Schema.isSchemaError()`.
