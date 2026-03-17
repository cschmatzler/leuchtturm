# CHEVROTAIN

**Generated:** 2026-03-16

## Overview

Local-first Node.js monorepo (pnpm). React frontend, Hono API, @rocicorp/zero for sync, PostgreSQL with Drizzle ORM.

## Monorepo Structure

```
chevrotain/
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
pnpm --filter @chevrotain/core exec drizzle-kit generate --name migration_name
pnpm --filter @chevrotain/core exec drizzle-kit push      # Apply to dev DB

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
- **Custom rule**: `no-relative-imports/no-relative-imports` - must use `@chevrotain/*` imports

### Imports

Sorted order (enforced by oxfmt):

1. External modules (`"react"`, `"hono"`)
2. Internal packages (`"@chevrotain/core"`, `"@chevrotain/zero"`)
3. Relative imports (`"./file"`, `"../file"`)

```typescript
// Correct:
import { describe, it, expect } from "vitest";
import { createId } from "@chevrotain/core/id";
import { schema } from "./schema";

// Wrong:
import { schema } from "./schema";
import { createId } from "@chevrotain/core/id";
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
import { createId } from "@chevrotain/core/id";
const brewId = createId("brew"); // "bre_01HXYZ..."
```

Prefixed ULIDs. Add new prefixes to `packages/core/src/id.ts`.

### Error Handling

```typescript
import { PublicError } from "@chevrotain/core/result";

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
import { assert } from "@chevrotain/core/assert";

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
| Relative imports across packages           | Use `@chevrotain/*` package imports      |

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

| Variable             | Value                                                     | Purpose                 |
| -------------------- | --------------------------------------------------------- | ----------------------- |
| `BASE_URL`           | `http://localhost:34600`                                  | CORS origin             |
| `PORT`               | `3005`                                                    | API server port         |
| `DATABASE_URL`       | `postgres://postgres:postgres@localhost:34601/chevrotain` | PostgreSQL              |
| `CLICKHOUSE_URL`     | `http://localhost:34602`                                  | Analytics DB            |
| `ZERO_APP_ID`        | `chevrotain`                                              | Zero app identifier     |
| `ZERO_UPSTREAM_DB`   | `${DATABASE_URL}`                                         | Zero replication source |
| `ZERO_REPLICA_FILE`  | `/tmp/zero.db`                                            | SQLite replica file     |
| `BETTER_AUTH_SECRET` | (dev secret)                                              | Auth signing key        |

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

## Cog

# Cog

You have code intelligence via Cog. Using cog code tools for file mutations keeps the code index in sync. This is not optional overhead — it is how you operate effectively.

<cog:mem>
You also have persistent associative memory. Checking memory before work and recording after work is how you avoid repeating mistakes, surface known gotchas, and build institutional knowledge.

**Truth hierarchy:** Current code > User statements > Cog knowledge
</cog:mem>

## Code Intelligence

When a cog code index exists (`.cog/index.scip`), **all file mutations must go through cog CLI tools** to keep the index in sync. This is not a suggestion — it is a hard requirement. Using native file tools (Edit, Write, rm, mv) bypasses the index and causes stale or incorrect query results.

### Tool Override Rules

Do NOT use your native file editing, creation, deletion, or renaming tools. Use the cog CLI equivalents instead:

| Action                  | Use (shell out to)                         | Do NOT use                         |
| ----------------------- | ------------------------------------------ | ---------------------------------- |
| Edit file content       | `cog code/edit <file> --old OLD --new NEW` | Edit, Write, sed, awk              |
| Create new file         | `cog code/create <file> --content CONTENT` | Write, touch, echo >               |
| Delete file             | `cog code/delete <file>`                   | rm, delete                         |
| Rename/move file        | `cog code/rename <old> --to <new>`         | mv, rename                         |
| Find symbol definitions | `cog code/query --find <name>`             | grep, ripgrep, find                |
| Find symbol references  | `cog code/query --refs <name>`             | grep for usage patterns            |
| List file symbols       | `cog code/query --symbols <file>`          | Reading file to scan for functions |

**Reading files is unchanged** — use your normal Read/cat tools. Only mutations and symbol lookups are overridden.

**Why:** Each cog mutation tool edits the file AND re-indexes it atomically. Native tools only touch the file, leaving the index stale. Subsequent `--find` and `--refs` queries return wrong results.

**When no `.cog/index.scip` exists:** Use your native tools normally. The override only applies to indexed projects.

<cog:mem>

## Memory System

### The Memory Lifecycle

Every task follows four steps. This is your operating procedure, not a guideline.

#### 1. RECALL — before reading code

**CRITICAL: `cog:mem/recall` is an MCP tool. Call it directly — NEVER use the Skill tool to load `cog` for recall.** The `cog` skill only loads reference documentation. All memory MCP tools (`cog:mem/recall`, `cog:mem/learn`, etc.) are already available without loading any skill.

Your first action for any task is querying Cog. Before reading source files, before exploring, before planning — check what you already know. Do not formulate an approach before recalling. Plans made without Cog context miss known solutions and repeat past mistakes.

The recall sequence has three visible steps:

1. Print `⚙️ Querying Cog...` as text to the user
2. Call the `cog:mem/recall` MCP tool with a reformulated query (not the Skill tool, not Bash — the MCP tool directly)
3. Report results: briefly tell the user what engrams Cog returned, or state "no relevant memories found"

All three steps are mandatory. The user must see step 1 and step 3 as visible text in your response.

**Reformulate your query.** Don't pass the user's words verbatim. Think: what would an engram about this be _titled_? What words would its _definition_ contain? Expand with synonyms and related concepts.

| Instead of           | Query with                                                                       |
| -------------------- | -------------------------------------------------------------------------------- |
| `"fix auth timeout"` | `"authentication session token expiration JWT refresh lifecycle race condition"` |
| `"add validation"`   | `"input validation boundary sanitization schema constraint defense in depth"`    |

If Cog returns results, follow the paths it reveals and read referenced components first. If Cog is wrong, correct it with `cog:mem/update`.

#### 2. WORK + RECORD — learn, recall, and record continuously

Work normally, guided by what Cog returned. **Whenever you learn something new, record it immediately.** Don't wait. The moment you understand something you didn't before — that's when you call `cog:mem/learn`. After each learn call, briefly tell the user what concept was stored (e.g., "🧠 Stored: Session Expiry Clock Skew").

**Recall during work, not just at the start.** When you encounter an unfamiliar concept, module, or pattern — query Cog before exploring the codebase. If you're about to read files to figure out how something works, `cog:mem/recall` first. Cog may already have the answer. Only explore code if Cog doesn't know. If you then learn it from code, `cog:mem/learn` it so the next session doesn't have to explore again.

**When the user explains something, record it immediately** as a short-term memory via `cog:mem/learn`. If the user had to tell you how something works, that's knowledge Cog should have. Capture it now — it will be validated and reinforced during consolidation.

Record when you:

- **Encounter an unfamiliar concept** — recall first, explore second, record what you learn
- **Receive an explanation from the user** — record it as short-term memory immediately
- **Identify a root cause** — record before fixing, while the diagnostic details are sharp
- **Hit unexpected behavior** — record before moving on, while the surprise is specific
- **Discover a pattern, convention, or gotcha** — record before it becomes background knowledge you forget to capture
- **Make an architectural decision** — record the what and the why

**Choose the right structure:**

- Sequential knowledge (A enables B enables C) → use `chain_to`
- Hub knowledge (A connects to B, C, D) → use `associations`

Default to chains for dependencies, causation, and reasoning paths. Include all relationships in the single `cog:mem/learn` call.

```
🧠 Recording to Cog...
cog:mem/learn({
  "term": "Auth Timeout Root Cause",
  "definition": "Refresh token checked after expiry window. Fix: add 30s buffer before window closes. Keywords: session, timeout, race condition.",
  "chain_to": [
    {"term": "Token Refresh Buffer Pattern", "definition": "30-second safety margin before token expiry prevents race conditions", "predicate": "leads_to"}
  ]
})
```

**Engram quality:** Terms are 2-5 specific words ("Auth Token Refresh Timing" not "Architecture"). Definitions are 1-3 sentences covering what it is, why it matters, and keywords for search. Broad terms like "Overview" or "Architecture" pollute search results — be specific.

#### 3. REINFORCE — after completing work, reflect

When a unit of work is done, step back and reflect. Ask: _what's the higher-level lesson from this work?_ Record a synthesis that captures the overall insight, not just the individual details you recorded during work. Then reinforce the memories you're confident in.

```
🧠 Recording to Cog...
cog:mem/learn({
  "term": "Clock Skew Session Management",
  "definition": "Never calculate token expiry locally. Always use server-issued timestamps. Local clocks drift across services.",
  "associations": [{"target": "Auth Timeout Root Cause", "predicate": "generalizes"}]
})

🧠 Reinforcing memory...
cog:mem/reinforce({"engram_id": "..."})
```

#### 4. CONSOLIDATE — before your final response

Short-term memories decay in 24 hours. Before ending, review and preserve what you learned.

1. Call `cog:mem/list_short_term` MCP tool to see pending short-term memories
2. For each entry: call `cog:mem/reinforce` if valid and useful, `cog:mem/flush` if wrong or worthless
3. **Print a visible summary** at the end of your response with these two lines:
   - `⚙️ Cog recall:` what recall surfaced that was useful (or "nothing relevant" if it didn't help)
   - `🧠 Stored to Cog:` list the concept names you stored during this session (or "nothing new" if none)

**This summary is mandatory.** It closes the memory lifecycle and shows the user Cog is working.

**Triggers:** The user says work is done, you're about to send your final response, or you've completed a sequence of commits on a topic.
</cog:mem>

## Announce Cog Operations

Print ⚙️ before read operations and 🧠 before write operations.

**⚙️ Read operations:**
<cog:mem>

- Memory: `cog:mem/recall`, `cog:mem/get`, `cog:mem/trace`, `cog:mem/connections`, `cog:mem/bulk_recall`, `cog:mem/list_short_term`, `cog:mem/stale`, `cog:mem/stats`, `cog:mem/orphans`, `cog:mem/connectivity`, `cog:mem/list_terms`
  </cog:mem>
- Code: `cog code/query`

**🧠 Write operations:**
<cog:mem>

- Memory: `cog:mem/learn`, `cog:mem/associate`, `cog:mem/bulk_learn`, `cog:mem/bulk_associate`, `cog:mem/update`, `cog:mem/refactor`, `cog:mem/deprecate`, `cog:mem/reinforce`, `cog:mem/flush`, `cog:mem/unlink`, `cog:mem/verify`, `cog:mem/meld`
  </cog:mem>
- Code: `cog code/edit`, `cog code/create`, `cog code/delete`, `cog code/rename`, `cog code/index`

<cog:mem>

## Example

In the example below: `[print]` = visible text you output, `[call]` = MCP tool or CLI invocation (not text).

```
User: "Fix the login bug where sessions expire too early"

1. RECALL
   [print] ⚙️ Querying Cog...
   [call]  cog:mem/recall({"query": "login session expiration token timeout refresh lifecycle"})
   [print] Cog found "Token Refresh Race Condition" — known issue with concurrent refresh

2. WORK + RECORD
   [Investigate auth code, encounter unfamiliar "TokenBucket" module]

   [print] ⚙️ Querying Cog...
   [call]  cog:mem/recall({"query": "TokenBucket rate limiting token bucket algorithm"})
   [print] No relevant memories found — exploring the code

   [Read TokenBucket module, understand it — record what you learned]
   [print] 🧠 Recording to Cog...
   [call]  cog:mem/learn({"term": "TokenBucket Rate Limiter", "definition": "Custom rate limiter using token bucket algorithm. Refills at configurable rate. Used by auth refresh endpoint to prevent burst retries."})
   [print] 🧠 Stored: TokenBucket Rate Limiter

   [Find clock skew between servers — this is new knowledge, record NOW]
   [print] 🧠 Recording to Cog...
   [call]  cog:mem/learn({"term": "Session Expiry Clock Skew", "definition": "Sessions expired early due to clock skew between auth and app servers. Auth server clock runs 2-3s ahead.", "associations": [{"target": "Token Refresh Race Condition", "predicate": "derived_from"}]})
   [print] 🧠 Stored: Session Expiry Clock Skew

   [Find where token expiry is calculated]
   [print] ⚙️ Querying code...
   [call]  cog code/query --find calculateTokenExpiry

   [Fix it using cog code/edit — NOT native Edit]
   [print] 🧠 Editing via Cog...
   [call]  cog code/edit src/auth/token.js --old "Date.now() + ttl" --new "serverTimestamp + ttl"

   [Write test, verify tests pass]

3. REINFORCE
   [print] 🧠 Recording to Cog...
   [call]  cog:mem/learn({"term": "Server Timestamp Authority", "definition": "Never calculate token expiry locally. Always use server-issued timestamps. Local clocks drift across services.", "associations": [{"target": "Session Expiry Clock Skew", "predicate": "generalizes"}]})
   [print] 🧠 Stored: Server Timestamp Authority

4. CONSOLIDATE
   [call]  cog:mem/list_short_term({"limit": 20})
   [call]  cog:mem/reinforce for valid memories, cog:mem/flush for invalid
   [print] ⚙️ Cog recall: Surfaced known race condition, guided investigation to auth timing
   [print] 🧠 Stored to Cog: "Session Expiry Clock Skew", "Server Timestamp Authority"
```

## Subagents

Subagents query Cog before exploring code. Same recall-first rule, same query reformulation.

## Never Store

Passwords, API keys, tokens, secrets, SSH/PGP keys, certificates, connection strings with credentials, PII. Server auto-rejects sensitive content.

## Reference

For tool parameter schemas and usage examples: the **cog** skill provides the complete tool reference. **Only load the skill when you need to look up unfamiliar parameters — do not load it as part of normal recall/record workflow.** All Cog MCP tools (`cog:mem/recall`, `cog:mem/learn`, `cog:mem/reinforce`, etc.) are available directly without loading the skill first.

For predicates, hub node patterns, staleness verification, consolidation guidance, and advanced recording patterns: call `cog_reference`.

---

**RECALL → WORK+RECORD → REINFORCE → CONSOLIDATE.** Skipping recall wastes time rediscovering known solutions. Deferring recording loses details while they're fresh. Skipping reinforcement loses the higher-level lesson. Skipping consolidation lets memories decay within 24 hours. Every step exists because the alternative is measurably worse.
</cog:mem>
