# Hono to @effect/platform Migration - Complete Documentation Index

**Project:** Chevrotain (Local-first Node.js monorepo)  
**Generated:** 2026-03-17  
**Status:** Complete API Inventory Collected

---

## Documentation Files Generated

This migration requires reviewing the following documentation files in order:

### 1. **HONO_API_INVENTORY.md** (731 lines)

Complete inventory of the Chevrotain Hono API implementation.

**Contains:**

- Executive summary of API structure
- 7 route groups and all endpoints
- File-by-file breakdown with full code snippets
- Error handling patterns and architecture
- Middleware stack and CORS configuration
- OpenTelemetry instrumentation details
- Effect runtime management
- Web client usage patterns
- Graceful shutdown sequence
- Testing patterns
- Migration considerations

**Use this for:** Understanding what needs to be migrated and how.

### 2. **HONO_SOURCE_REFERENCE.md** (400+ lines)

Complete source code for all Hono API files.

**Contains:**

- Full source of every file mentioned in inventory
- Ready for direct comparison with new implementation
- Includes all imports and dependencies

**Use this for:** Copy-paste reference while writing new Effect/HttpApi implementation.

### 3. **EFFECT_PLATFORM_RESEARCH.md** (28KB)

Research on @effect/platform capabilities.

**Contains:**

- HttpApi module documentation
- Middleware patterns
- Error handling approaches
- Testing setup
- Example implementations
- Comparison with Hono

**Use this for:** Understanding @effect/platform capabilities and limitations.

### 4. **EFFECT_PLATFORM_QUICK_START.md** (8.8KB)

Quick reference for @effect/platform basics.

**Contains:**

- Basic HttpApi setup
- Routing patterns
- Middleware creation
- Error handling patterns
- Server creation

**Use this for:** Quick reference while coding.

### 5. **EFFECT_PLATFORM_INDEX.md** (11KB)

Detailed index of @effect/platform modules and capabilities.

**Contains:**

- Module organization
- Type definitions
- Handler signatures
- Utility functions
- API methods

**Use this for:** Looking up specific API methods and signatures.

### 6. **AGENTS.md** (14KB)

Original project AGENTS.md with all conventions.

**Contains:**

- Universal commands and patterns
- TypeScript and linting rules
- Import ordering
- Testing conventions
- Tech stack overview

**Use this for:** Ensuring migration follows project conventions.

---

## Migration Roadmap

### Phase 1: Planning (Current)

- [x] Collect complete Hono API inventory
- [x] Document all files and their purposes
- [x] Analyze error handling patterns
- [x] Understand middleware stack
- [x] Map all routes and their characteristics

### Phase 2: Infrastructure

- [ ] Create new HttpApi server in `apps/api/src/index.ts`
- [ ] Set up middleware layer
- [ ] Implement error handling
- [ ] Set up OpenTelemetry integration
- [ ] Implement rate limiting

### Phase 3: Routes

- [ ] Migrate `/metrics` endpoint
- [ ] Migrate `/up` health check
- [ ] Migrate `/auth/*` routes
- [ ] Migrate `/query` Zero sync endpoint
- [ ] Migrate `/mutate` Zero sync endpoint
- [ ] Migrate `/analytics` endpoint
- [ ] Migrate `/errors` endpoint
- [ ] Migrate `/autumn` billing endpoint

### Phase 4: Testing & Validation

- [ ] Update all tests for new HttpApi
- [ ] Verify error handling works correctly
- [ ] Test all routes with client
- [ ] Load test and performance check
- [ ] Update web client if needed

### Phase 5: Deployment

- [ ] Build and verify bundle
- [ ] Deploy to staging
- [ ] Monitor for errors
- [ ] Deploy to production
- [ ] Remove old Hono code

---

## Key Files to Migrate

| File                   | Lines | Purpose                          | Migration Notes                       |
| ---------------------- | ----- | -------------------------------- | ------------------------------------- |
| src/index.ts           | 175   | Main app, routes, error handling | Largest - highest priority            |
| src/server.ts          | 24    | Server entry point               | Minimal changes needed                |
| src/query.ts           | 24    | Zero query sync                  | Keep logic, convert to HttpApi        |
| src/mutate.ts          | 31    | Zero mutation sync               | Keep logic, convert to HttpApi        |
| src/autumn.ts          | 28    | Billing webhooks                 | Keep logic, convert to HttpApi        |
| src/middleware/auth.ts | 24    | Auth middleware                  | Convert to HttpApi middleware         |
| src/analytics/index.ts | 44    | Analytics endpoint               | Convert to HttpApi handler            |
| src/errors/index.ts    | 95    | Error reporting + rate limiting  | Convert to HttpApi handler            |
| src/errors/mapping.ts  | 87    | Error mapping                    | **No changes** - reuse as-is          |
| src/instrumentation.ts | 30    | OpenTelemetry setup              | **No changes** - keep as-is           |
| src/runtime.ts         | 65    | Effect runtime                   | **No changes** - keep as-is           |
| package.json           | 40    | Dependencies                     | Add @effect/platform, remove @hono/\* |
| rolldown.config.ts     | 12    | Build config                     | May need minor adjustments            |

**Total Lines:** 585 lines of code to migrate

**Lines That Don't Change:** 182 (errors/mapping.ts, instrumentation.ts, runtime.ts)

**New Lines to Write:** ~400-500 (HttpApi equivalents)

---

## Architecture Comparison

### Current Hono Structure

```
Hono App
├── Global middleware (CORS, metrics, instrumentation)
├── Route groups (mounted as sub-apps)
└── Global error handler
```

### Target HttpApi Structure

```
HttpApi App
├── Middleware layer (CORS, metrics, instrumentation)
├── Route definitions (handlers composed)
└── Error handler (effect-based)
```

### Key Differences to Handle

1. **Route Definition**
   - Hono: `.route()` method with sub-apps
   - HttpApi: Composed routes with handlers

2. **Context/Variables**
   - Hono: `.use()` middleware sets context via `.set()`
   - HttpApi: Context passed through handler parameters

3. **Error Handling**
   - Hono: `.onError()` global handler
   - HttpApi: Effect-based error handling (already compatible!)

4. **Middleware**
   - Hono: Functions that call `next()`
   - HttpApi: Effect-based middleware

5. **Request/Response**
   - Hono: `c.req`, `c.json()`, `c.text()`
   - HttpApi: Direct request objects, response builders

---

## Implementation Strategy

### Phased Approach

1. **Create new HttpApi app** in a new file (e.g., `src/api-effect.ts`)
2. **Gradually migrate routes** one by one
3. **Keep old Hono app** running until new one is complete
4. **Test thoroughly** each route migration
5. **Switch over** once all routes working
6. **Remove Hono code** in final cleanup

### Testing Strategy

- Keep existing tests, update for new implementation
- Add integration tests for new HttpApi routes
- Verify client still works (no type changes needed)
- Load test to ensure performance

### Rollback Plan

- Keep git history
- Easy to revert if issues arise
- Hono code remains in git history

---

## Critical Patterns to Maintain

1. **Error Handling**
   - TaggedError mapping to status codes
   - PublicError support (for Zero mutations)
   - ClickHouse error logging on 500s
   - OpenTelemetry span recording

2. **Auth**
   - Get session from request headers
   - Set user/session in context
   - Return 401 for missing session

3. **Effect Runtime**
   - Use `runEffect()` in handlers
   - Use `runEffectFork()` in error handlers
   - Don't break service composition

4. **Rate Limiting**
   - IP extraction from headers
   - 30 requests per 60 seconds
   - Cleanup on interval

5. **CORS**
   - Origin: `process.env.BASE_URL`
   - Headers: Content-Type, Authorization
   - Methods: GET, POST, OPTIONS
   - Credentials: true
   - MaxAge: 600

---

## Dependency Changes

### Remove

```json
"@hono/node-server": "1.19.11",
"@hono/otel": "1.1.1",
"@hono/prometheus": "1.0.2",
"@hono/standard-validator": "0.2.2",
"hono": "4.12.8",
```

### Add

```json
"@effect/platform": "^VERSION",
"@effect/platform-node": "^VERSION",
```

### Keep (Already Compatible)

```json
"@opentelemetry/*": "...",  // OpenTelemetry unchanged
"effect": "4.0.0-beta.33",  // Already using Effect
"prom-client": "15.1.3",    // Prometheus still works
"@rocicorp/zero": "0.26.1", // Zero logic unchanged
"arktype": "2.2.0",         // Validation still works
"autumn-js": "1.0.1",       // Billing logic unchanged
"@chevrotain/*": "...",     // Internal packages unchanged
```

---

## Success Criteria

- [ ] All 7 routes working
- [ ] All error types handled correctly
- [ ] Auth middleware functional
- [ ] Rate limiting works
- [ ] OpenTelemetry tracing works
- [ ] Prometheus metrics collected
- [ ] Web client still works
- [ ] All tests passing
- [ ] Performance at least equivalent to Hono

---

## Resources

### In This Repository

- HONO_API_INVENTORY.md - This complete inventory
- HONO_SOURCE_REFERENCE.md - All source code
- EFFECT*PLATFORM*\*.md - Research and quick start
- AGENTS.md - Project conventions

### External Resources

- @effect/platform docs: https://effect.website/
- Effect guide: https://effect.website/guide/
- Zero sync protocol: https://rocicorp.dev/docs/zero/

---

## Next Steps

1. **Read HONO_API_INVENTORY.md** completely
2. **Review HONO_SOURCE_REFERENCE.md** to understand current implementation
3. **Study EFFECT_PLATFORM_QUICK_START.md** for basic patterns
4. **Create new HttpApi implementation** in stages
5. **Test each route migration** thoroughly
6. **Run full test suite** before switching
7. **Verify web client** still works

---

## Questions to Answer Before Starting

1. How does @effect/platform handle sub-routes/nested apps?
2. What's the equivalent of Hono's `sValidator` in HttpApi?
3. How do we set context variables in HttpApi handlers?
4. How does error handling work with Effect layers?
5. What's the best way to structure middleware in HttpApi?
6. Can we keep the rate limiting logic as-is?

See EFFECT_PLATFORM_RESEARCH.md for answers to these questions.

---

**Last Updated:** 2026-03-17
**Files Generated:** 6 documentation files
**Total Lines Collected:** 2000+
**Code Files Analyzed:** 13
**Routes Identified:** 8
**Endpoints:** 14 (counting sub-routes)
