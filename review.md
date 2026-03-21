# Effect v4 usage review

## Overall take

You are **mostly on the right track** for Effect v4.

The codebase already has a lot of the good stuff:

- `Layer`-driven service composition
- `Effect.gen` for request handlers and service construction
- explicit error channels with tagged schema errors
- span/log annotations in the hot paths
- service access via tags instead of ad hoc parameter threading

If I had to score it purely on **"super idiomatic Effect v4"**, I’d call it:

- **architecture:** good
- **effect usage inside handlers/services:** very good
- **boundary management / runtime purity:** mixed
- **pipe consistency:** good, but not fully consistent

So: **idiomatic overall, but not yet "Effect-maximalist"**.

---

## What already feels very idiomatic

### 1. Services are modeled as Effect services, not random globals

These are the strongest parts of the codebase:

- `packages/core/src/analytics/service.ts`
- `packages/core/src/drizzle/service.ts`
- `packages/core/src/email/service.ts`
- `packages/core/src/rate-limit/service.ts`
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/auth-live.ts`

Pattern quality is good:

- service shape interface
- tag/service definition
- `Layer.effect(...)`
- dependency acquisition inside `Effect.gen`
- downstream access via `yield* ServiceTag`

That is solid Effect code.

### 2. Handler code is generally nice and compositional

These files are pretty clean:

- `apps/api/src/handlers/auth.ts`
- `apps/api/src/handlers/rpc.ts`
- `apps/api/src/handlers/zero.ts`
- `apps/api/src/metrics.ts`

Good signs:

- `Effect.fn(...)` on some handlers
- `Effect.tryPromise(...)` around foreign async boundaries
- `Effect.withSpan(...)`
- `Effect.annotateCurrentSpan(...)`
- `Effect.tapError(...)`
- error translation into domain errors

That’s exactly where Effect tends to pay off, and you’re using it well.

### 3. Config usage inside layers is good

Good examples:

- `packages/core/src/analytics/service.ts`
- `packages/core/src/drizzle/service.ts`
- `packages/core/src/email/service.ts`
- `apps/api/src/observability.ts`

Using `Config` at layer construction time is the right shape.

### 4. Schema usage is clean

These files look good and pretty idiomatic:

- `packages/core/src/errors.ts`
- `packages/core/src/schema.ts`
- `packages/core/src/auth/schema.ts`
- `packages/core/src/analytics/schema.ts`
- `apps/api/src/contract.ts`
- `apps/api/src/contract-rpc.ts`

No major weirdness there.

---

## Biggest places where it is **not** fully idiomatic Effect v4

## 1. The codebase still splits into an Effect world and a singleton/module-init world

This is the main thing keeping it from feeling fully "all-in" on Effect.

Files involved:

- `packages/core/src/config.ts`
- `packages/email/src/config.ts`
- `packages/email/src/index.ts`
- `packages/core/src/drizzle/index.ts`
- `packages/core/src/auth/index.ts`
- `packages/core/src/billing/polar.ts`
- `packages/core/src/billing/webhooks.ts`

### Why this matters

A super idiomatic Effect app tries to keep resource acquisition, config loading, and external clients inside `Layer`s / runtime-managed services.

Right now you have two styles living side by side:

1. **Effect-native style**
   - `DatabaseServiceLive`
   - `EmailServiceLive`
   - `ClickHouseServiceLive`
   - `RateLimitServiceLive`

2. **module-global style**
   - `databaseUrl = runSync(...)`
   - `resendApiKey = runSync(...)`
   - `const pool = new Pool(...)`
   - `export const db = drizzle(...)`
   - `export const auth = betterAuth(...)`
   - `export const polarClient = new Polar(...)`

That second group is the least Effect-ish part of the repo.

### My take

This is **not wrong**, especially because libraries like Better Auth, Drizzle node clients, Polar SDK, and Zero often want plain JS values.

But if the goal is **"super idiomatic Effect v4"**, then this is the main architectural gap.

### Recommendation level

- **High priority**, architecturally
- not because the code is bad
- because this is the main place where the app stops being runtime-managed

---

## 2. Top-level `runSync` config loading is convenient, but not very Effect-native

Files:

- `packages/core/src/config.ts`
- `packages/email/src/config.ts`

Examples of the pattern:

- `loadSync(Effect.gen(...))`
- `Effect.runSync(Effect.gen(...))`

### Why it’s less idiomatic

In Effect-heavy code, config is usually:

- loaded in a layer
- provided through services
- or resolved once in the main program boundary

Running config effects at module import time means:

- config resolution is no longer runtime-managed
- import order matters more
- failures happen during module loading instead of in the app effect graph

### Pipe/style note

Even if you keep this pattern, the current style is not fully pipe-first.

These would read more consistently as:

- `Effect.gen(...).pipe(Effect.runSync)`
- or a small config layer instead of `loadSync(...)`

### Recommendation level

- **Medium/high priority** if you want purist Effect style
- **Low priority** if you’re optimizing for pragmatism over purity

---

## 3. `server.ts` is more imperative than the rest of the app

File:

- `apps/api/src/server.ts`

This file is the least pipe-y / least Effect-y part of the runtime boot sequence.

### Why

You build the runtime in Effect-land, but then do a bunch of top-level imperative steps:

- `ManagedRuntime.make(...)`
- multiple `await runtime.runPromise(...)`
- process signal wiring outside a single Effect program

### Why this stands out

This isn’t broken, but compared to the rest of the repo it feels like:

- "use Effect to build the world"
- then "drop back to ad hoc Node orchestration"

A more idiomatic shape would be:

- one `main` effect
- runtime acquisition/disposal scoped around that
- startup logging inside the same program
- shutdown handling modeled closer to an Effect lifecycle boundary

### Recommendation level

- **High priority for style consistency**
- probably the single best file to improve if you want the app to feel more uniformly Effect-native

---

## 4. A few combinator calls are still data-first instead of pipe-first

If your bar is literally **"make sure everything is piped"**, then there are still some spots I’d flag.

### Clear examples

#### `packages/core/src/config.ts`

Current style:

- `loadSync(Effect.gen(...))`

More pipe-consistent style:

- `Effect.gen(...).pipe(Effect.runSync)`

#### `packages/email/src/config.ts`

Current style:

- `Effect.runSync(Effect.gen(...))`

More pipe-consistent style:

- `Effect.gen(...).pipe(Effect.runSync)`

#### `apps/api/src/metrics.ts`

Current style:

- `Effect.map(metricsText, (body) => ...)`

More idiomatic with your repo’s style:

- `metricsText.pipe(Effect.map((body) => ...))`

#### `apps/api/src/index.ts`

Current style:

- `Effect.flatten(HttpRouter.toHttpEffect(RoutesLive))`

Pipe-first style would be more consistent.

### My take

These are **small style inconsistencies**, not architectural problems.

I would treat them as:

- **low risk**
- **easy cleanup**
- mostly worth doing for consistency and readability

---

## 5. `RateLimitServiceLive` is correct, but the resource model is a bit manual

File:

- `packages/core/src/rate-limit/service.ts`

What you’re doing now:

- allocate `Map`
- start `setInterval`
- clean it up with `Effect.addFinalizer`

### This is okay

It is still scoped and it does clean up after itself.

### Why I’m still flagging it

It reads more like careful Node resource management than native Effect scheduling/concurrency.

That’s not a correctness complaint. It’s just slightly less idiomatic than the surrounding layer code.

### Recommendation level

- **Low/medium**
- only worth changing if you want to push the codebase further toward Effect-native lifecycle patterns

---

## 6. Some foreign-library boundaries stay outside Effect entirely

Files:

- `packages/core/src/auth/index.ts`
- `packages/core/src/billing/webhooks.ts`
- `packages/core/src/drizzle/index.ts`
- `packages/email/src/index.ts`

### Why it matters

Effect code is most valuable when:

- side effects are explicit
- failures are modeled
- dependencies are injectable
- lifecycle is runtime-managed

These files mostly expose plain values or async functions directly.

Again: sometimes that is the right tradeoff.
But from a pure review standpoint, this is where the codebase is most "just TypeScript" and least "Effect v4".

---

## File-by-file review notes

## `packages/core/src/analytics/service.ts`

**Verdict: very good**

What’s good:

- layer-backed service
- config in effect
- acquisition via `Effect.acquireRelease`
- domain error mapping
- logs are piped/annotated cleanly

Minor note:

- the client creation and insert calls are foreign API boundaries, so the current `tryPromise` shape is appropriate
- no major style issue here

## `packages/core/src/drizzle/service.ts`

**Verdict: very good**

What’s good:

- good use of `Layer.unwrap`
- config resolved in effect
- DB service exposed as a proper service
- `Layer.provide(PgClientLive)` is nice and compositional

Minor note:

- this file is more idiomatic than `packages/core/src/drizzle/index.ts`
- having both patterns in the repo makes the architecture feel split

## `packages/core/src/email/service.ts`

**Verdict: good to very good**

What’s good:

- layer-backed service
- config inside effect
- foreign async API wrapped with `Effect.tryPromise`
- domain error mapping is explicit

Minor note:

- the `send` implementation could be made more pipe-first / combinator-first
- right now it’s totally fine, just a bit more generator-y than necessary

## `packages/core/src/rate-limit/service.ts`

**Verdict: good**

What’s good:

- lifecycle cleanup exists
- error channel is explicit
- logs are annotated properly

What’s less idiomatic:

- raw `setInterval` resource management instead of a more Effect-native scheduling pattern

## `apps/api/src/middleware/auth-live.ts`

**Verdict: very good**

This is strong Effect code:

- environment access via request service
- external async boundary wrapped in `tryPromise`
- tracing via `withSpan`
- contextual service injection via `Effect.provideService`

This is one of the cleaner files in the repo.

## `apps/api/src/handlers/rpc.ts`

**Verdict: very good**

This file feels natural in Effect:

- service access via `yield*`
- span annotation
- fail-soft behavior through `catchTag`
- pipe usage is strong

No major complaints.

## `apps/api/src/handlers/zero.ts`

**Verdict: good to very good**

Good boundary handling around foreign promise APIs.

Minor note:

- this is still inherently integration-heavy code, so some imperative feel is unavoidable
- still, it’s in a good place

## `apps/api/src/index.ts`

**Verdict: good**

The layer composition is strong.

Only minor style note:

- there are still a couple non-pipe combinator uses
- nothing serious

## `apps/api/src/observability.ts`

**Verdict: good**

This is mostly solid.

Good:

- `Config.all(...).pipe(Config.map(...))`
- conditional layer assembly is clear
- `Layer.effectDiscard(Effect.acquireRelease(...))` is sensible

Minor note:

- `Effect.sync(() => getTracingBootstrap())` looks like a pure lookup, so it reads slightly heavier than necessary
- tiny nit, not a real issue

## `apps/api/src/server.ts`

**Verdict: the biggest style outlier**

Not bad code.
Just the least idiomatic Effect file in the runtime.

Why:

- top-level imperative control flow
- multiple separate `runPromise` calls
- lifecycle orchestration is not modeled as one coherent program

If you only refactor one file for "Effect purity", this is the one.

---

## Prioritized recommendations

## Priority 1 — biggest payoff

### Move more singleton boundaries behind layers/services

Best candidates:

- `packages/core/src/drizzle/index.ts`
- `packages/core/src/auth/index.ts`
- `packages/email/src/index.ts`
- `packages/core/src/billing/polar.ts`

This is the main thing preventing the architecture from feeling fully Effect-native.

## Priority 2 — make bootstrap more Effect-native

File:

- `apps/api/src/server.ts`

If you want the repo to feel more idiomatic as a whole, this is the best style refactor target.

## Priority 3 — mechanical pipe cleanup

Files:

- `packages/core/src/config.ts`
- `packages/email/src/config.ts`
- `apps/api/src/metrics.ts`
- `apps/api/src/index.ts`

These are easy consistency wins.

## Priority 4 — optional purity cleanup

File:

- `packages/core/src/rate-limit/service.ts`

Not urgent. More of an aesthetic / lifecycle-modeling improvement.

---

## Bottom line

If your question is:

> is this already idiomatic Effect v4?

My answer is:

**yes, mostly — especially in the service and handler layers.**

If your question is:

> is this super idiomatic, fully pipe-first, Effect-all-the-way-down v4?

My answer is:

**not yet.**

The main gaps are:

1. too many module-level singletons / import-time effects
2. bootstrap is still fairly imperative
3. a handful of non-pipe combinator calls remain

So the short version is:

- **inside the app logic:** good Effect style
- **at the boundaries:** still somewhat hybrid
- **pipe consistency:** good, not fully strict

If you want, next step I can turn this into a **ranked actionable refactor plan** or go file-by-file and tell you exactly what I would rewrite first.
