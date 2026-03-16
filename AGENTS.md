# ONE

**Generated:** 2026-03-16

## Overview

Local-first Node.js monorepo (pnpm). React frontend, Hono API, @rocicorp/zero for sync, PostgreSQL with Drizzle ORM.

## Monorepo Structure

```
one/
├── apps/
│   ├── api/          # Hono server (see apps/api/AGENTS.md)
│   ├── web/          # React + TanStack + Zero frontend (see apps/web/AGENTS.md)
│   └── zero-cache/   # Zero sync server config
├── packages/
│   ├── core/         # Auth, DB schemas, ID generation, errors (see packages/core/AGENTS.md)
│   ├── zero/         # Zero schema, mutators, queries (see packages/zero/AGENTS.md)
│   └── email/        # React Email templates (see packages/email/AGENTS.md)
├── modules/          # Nix flake modules (auto-loaded via import-tree)
├── platform/         # NixOS production deployment
├── scripts/          # Build/maintenance scripts (Nushell)
├── secrets/          # SOPS-encrypted secrets
└── nix/              # Shared Nix configuration
```

Each package/app has its own AGENTS.md with specific patterns.

## Universal Commands

**All commands must be run from the repository root.**

```bash
vp install                        # Install deps
vp lint --type-aware --type-check # Lint + type check
treefmt                           # Format all files
vp test                           # Run all tests
vp test path/to/file              # Single test file

# Database (from root)
pnpm --filter @one/core exec drizzle-kit generate --name migration_name
pnpm --filter @one/core exec drizzle-kit push      # Apply to dev DB

# Local dev (via devenv)
# Starts: Caddy (34600), Postgres (34601), Vite (5173), API (3000), Zero (4848)

# Deployment
deploy .#sixth-coffee              # Deploy to production (NixOS via deploy-rs)
```

Always run `vp lint --type-aware --type-check` and `vp test` after making changes.

After any dependency changes (`package.json` or `pnpm-lock.yaml`), run `nu scripts/update-pnpm-hash.nu` to update the Nix `fetchPnpmDeps` hash.

## Universal Code Style

These rules apply to **every package and app** in the monorepo:

### TypeScript

- **Runtime**: Node.js 25 with TypeScript strict mode
- **Target**: ESNext modules, `verbatimModuleSyntax`
- **Strict**: All strict checks enabled
- **No emit**: TypeScript for type checking only

### Formatting

- **Formatter**: oxfmt via `vp fmt`
- **Tabs**: Tab indentation
- **Quotes**: Double quotes
- **Semicolons**: Always
- **Trailing commas**: Always on multiline

### Linting

- **Linter**: oxlint with typescript, react, unicorn, import plugins
- **Custom rule**: `no-relative-imports/no-relative-imports` - must use `@one/*` imports

### Imports

Sorted order (enforced by oxfmt):

1. External modules (`"react"`, `"hono"`)
2. Internal packages (`"@one/core"`, `"@one/zero"`)
3. Relative imports (`"./file"`, `"../file"`)

```typescript
// Correct:
import { describe, it, expect } from "vitest";
import { createId } from "@one/core/id";
import { schema } from "./schema";

// Wrong:
import { schema } from "./schema";
import { createId } from "@one/core/id";
import { describe, it, expect } from "vitest";
```

### Naming Conventions

| Category    | Convention                     | Examples                     |
| ----------- | ------------------------------ | ---------------------------- |
| Functions   | camelCase                      | `createId`, `getUser`        |
| Variables   | camelCase                      | `brewId`, `userName`         |
| Types       | PascalCase                     | `BrewRow`, `UserRow`         |
| Components  | PascalCase                     | `Button`, `Dialog`           |
| Props types | `XProps`                       | `ButtonProps`, `DialogProps` |
| State types | `XState`                       | `FormState`, `FilterState`   |
| Constants   | PascalCase or UPPER_SNAKE_CASE | `PREFIXES`, `MAX_RETRIES`    |
| Files       | kebab-case                     | `use-local-storage.ts`       |

### Naming Anti-Patterns (Never)

| Never                      | Instead                   |
| -------------------------- | ------------------------- |
| `Type` suffix on types     | `Method` not `MethodType` |
| `Data` suffix on variables | `bean` not `beanData`     |
| Abbreviations              | `temperature` not `temp`  |
| `I` prefix for interfaces  | `User` not `IUser`        |

### Testing

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";

describe("function", () => {
	describe("behavior or feature", () => {
		it("does something when condition", () => {
			expect(result).toBe(expected);
		});
	});
});
```

Testing conventions:

- Tests colocated with source: `file.ts` → `file.test.ts`
- Use `describe` for grouping (max 3 levels deep)
- Use `it` for individual tests
- Readable test names: `it("returns true when condition")`
- Mock with `vi.fn()`, `vi.mock()`, `vi.spyOn()`
- Use `vi.hoisted()` for module-level mocks
- Factory functions for test data
- Explicit assertions (no snapshots)

## Universal Patterns

### ID Generation

```typescript
import { createId } from "@one/core/id";
const brewId = createId("brew"); // "bre_01HXYZ..."
```

Prefixed ULIDs. Add new prefixes to `packages/core/src/id.ts`.

### Error Handling

```typescript
import { PublicError } from "@one/core/result";

throw new PublicError({ status: 403, global: [{ message: "Forbidden" }] });
throw new PublicError({
	status: 400,
	fields: [{ path: ["email"], message: "Invalid email" }],
});
```

API errors use `PublicError` with status codes and structured error format:

```typescript
{
	success: false,
	error: {
		global: [{ code?: string; message: string }],
		fields: [{ path: (string | number)[]; message: string }]
	}
}
```

### Assertions

```typescript
import { assert } from "@one/core/assert";

const [bean] = await db.select().from(beanTable).where(eq(beanTable.id, id)).limit(1);
assert(bean); // Narrows T | null | undefined → T, throws 404 if missing
```

### Import from vite-plus

All testing and build utilities import from `vite-plus`:

```typescript
import { describe, it, expect, vi } from "vite-plus/test";
import { defineConfig } from "vite-plus";
```

### Nullish Coalescing

Always use `??` for null/undefined fallbacks:

```typescript
const remaining = bean.remainingGrams ?? 0; // Correct
const remaining = bean.remainingGrams || 0; // Wrong (catches 0, "")
```

### Async/Await

Always `await` async operations. Never fire-and-forget:

```typescript
await zero.mutate.bean.create(data); // Correct
void zero.mutate.bean.create(data); // Wrong
```

## Universal Anti-Patterns

| Never                                      | Why                                      |
| ------------------------------------------ | ---------------------------------------- | ---------------------- | ---------------- |
| `as any`, `@ts-ignore`, `@ts-expect-error` | Type safety is enforced                  |
| Empty catch blocks                         | Handle errors or rethrow                 |
| Hardcoded IDs                              | Use `createId(prefix)`                   |
| `void asyncFn()` fire-and-forget           | Always `await` async operations          |
| `console.log` in production code           | Use proper logging/monitoring            |
| `                                          |                                          | ` for nullish checking | Use `??` instead |
| `git commit --amend`                       | Always create new commits                |
| Python/Perl for scripts                    | Use Nushell (`nu`) for all scripting     |
| Direct package manager usage               | Use `vp` commands, not pnpm/npm directly |
| Relative imports across packages           | Use `@one/*` package imports             |

## Tech Stack Quick Reference

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Runtime  | Node.js 25                                                   |
| Frontend | React 19, TanStack (Router/Query/Table/Form), @rocicorp/zero |
| API      | Hono with CORS                                               |
| Auth     | better-auth (magic link, organizations, multi-session)       |
| Database | PostgreSQL, Drizzle ORM                                      |
| Sync     | @rocicorp/zero (local-first)                                 |
| Billing  | autumn-js                                                    |
| Email    | React Email + Resend                                         |
| Infra    | NixOS, Colmena, SOPS                                         |
| Testing  | vitest via vite-plus                                         |

## Vite+ Toolchain

Unified toolchain (Vite + Rolldown + Vitest + Oxlint + Oxfmt):

```bash
vp dev          # Development server
vp build        # Production build
vp lint         # Lint code
vp test         # Run tests
vp fmt          # Format code
vp install      # Install dependencies
vp add <pkg>    # Add dependency
```

## Environment Variables

### Development (devenv)

| Variable             | Value                                              | Purpose                 |
| -------------------- | -------------------------------------------------- | ----------------------- |
| `BASE_URL`           | `http://localhost:34600`                           | CORS origin             |
| `PORT`               | `3005`                                             | API server port         |
| `DATABASE_URL`       | `postgres://postgres:postgres@localhost:34601/one` | PostgreSQL              |
| `CLICKHOUSE_URL`     | `http://localhost:34602`                           | Analytics DB            |
| `ZERO_APP_ID`        | `one`                                              | Zero app identifier     |
| `ZERO_UPSTREAM_DB`   | `${DATABASE_URL}`                                  | Zero replication source |
| `ZERO_REPLICA_FILE`  | `/tmp/zero.db`                                     | SQLite replica file     |
| `BETTER_AUTH_SECRET` | (dev secret)                                       | Auth signing key        |

### Production

Loaded from SOPS-encrypted `secrets/*.env` files via `sops-nix`.

## Nix Configuration

### flake.nix

Auto-generated via `nix run .#write-flake` using `flake-file` framework.

Uses `import-tree` pattern to auto-discover modules from `./modules` directory.

### modules/ (Flake Modules)

| Module          | Purpose                               |
| --------------- | ------------------------------------- |
| `defaults.nix`  | Global defaults, state version        |
| `hosts.nix`     | Host declarations via `den` framework |
| `deploy.nix`    | deploy-rs configuration               |
| `packages.nix`  | Nix derivations for apps              |
| `dendritic.nix` | flake-file framework integration      |

### nix/config.nix

Shared configuration constants:

```nix
{
  domain = "sixth.coffee";
  ports = {
    api = 3080;
    zeroCache = 3081;
    clickhouse = 8123;
    grafana = 3000;
    # ...
  };
}
```

### scripts/ (Nushell)

| Script                   | Purpose                                |
| ------------------------ | -------------------------------------- |
| `update-pnpm-hash.nu`    | Update Nix fetchPnpmDeps hash          |
| `extract-locale-keys.nu` | Sync i18n translations                 |
| `rename.nu`              | Project-wide rename with case variants |

## Deployment Flow

1. **Code Change**: Modify code in monorepo
2. **Lint & Test**: `vp lint --type-aware --type-check && vp test`
3. **Format**: `treefmt`
4. **Update Hash**: `nu scripts/update-pnpm-hash.nu` (if deps changed)
5. **Build**: `nix build .#api .#web`
6. **Deploy**: `deploy .#sixth-coffee`

## Where to Look

| Task                    | Location                                  | See Also                 |
| ----------------------- | ----------------------------------------- | ------------------------ |
| Add API endpoint        | `apps/api/src/index.ts`                   | apps/api/AGENTS.md       |
| Add Zero mutation       | `packages/zero/src/mutators/`             | packages/zero/AGENTS.md  |
| Add Zero query          | `packages/zero/src/queries.ts`            | packages/zero/AGENTS.md  |
| Add DB table            | `packages/core/src/{domain}/`             | packages/core/AGENTS.md  |
| Add page/route          | `apps/web/src/pages/`                     | apps/web/AGENTS.md       |
| Add UI component        | `apps/web/src/components/ui/`             | apps/web/AGENTS.md       |
| Add ID prefix           | `packages/core/src/id.ts`                 | packages/core/AGENTS.md  |
| Modify auth             | `packages/core/src/auth/`                 | packages/core/AGENTS.md  |
| Add email template      | `packages/email/src/`                     | packages/email/AGENTS.md |
| Handle billing webhooks | `apps/api/src/autumn.ts`                  | apps/api/AGENTS.md       |
| Modify Nix config       | `modules/` or `nix/config.nix`            |                          |
| Add deployment host     | `modules/{hostname}.nix`                  |                          |
| Add monitoring metric   | `platform/hosts/{host}/observability.nix` |                          |

## Review Checklist

- [ ] Run `vp install` after pulling remote changes
- [ ] Run `vp lint --type-aware --type-check` after changes
- [ ] Run `treefmt` to format files
- [ ] Run `vp test` to validate changes
- [ ] Update `fetchPnpmDeps` hash if dependencies changed
- [ ] No relative imports across packages
- [ ] No `Type` or `Data` suffixes in new code
- [ ] All async operations awaited
