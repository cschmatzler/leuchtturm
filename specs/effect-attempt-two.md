# Effect migration attempt two

## Goal

Put this codebase into a structure that matches the useful parts of opencode's Effect migration, without copying the parts that do not fit this repo.

The parts we want to adopt from opencode are:

- a single owning namespace per service module
- `Service` + `layer` + `defaultLayer` structure
- a shared `makeRunPromise` helper for long-lived managed runtimes
- plain async facade functions at non-Effect boundaries
- `HttpClient.HttpClient` for outbound HTTP that we own
- explicit service surfaces instead of leaking vendor SDK objects

The parts we do **not** want to cargo-cult are:

- `InstanceState`
- filesystem-specific migration patterns
- per-directory/per-project scoped service state

## External reference

Primary reference:

- `https://github.com/anomalyco/opencode/blob/dev/packages/opencode/specs/effect-migration.md`

Key opencode files reviewed:

- `packages/opencode/src/effect/run-service.ts`
- `packages/opencode/src/account/index.ts`
- `packages/opencode/src/auth/index.ts`
- `packages/opencode/src/installation/index.ts`
- `packages/opencode/src/provider/auth.ts`
- `packages/opencode/src/skill/discovery.ts`

## What opencode is doing that matters to us

### 1. Shared runtime helper

opencode centralizes long-lived service runtimes in `run-service.ts`:

```ts
export const memoMap = Layer.makeMemoMapUnsafe();

export function makeRunPromise<I, S, E>(
	service: ServiceMap.Service<I, S>,
	layer: Layer.Layer<I, E>,
) {
	let rt: ManagedRuntime.ManagedRuntime<I, E> | undefined;

	return <A, Err>(fn: (svc: S) => Effect.Effect<A, Err, I>, options?: Effect.RunOptions) => {
		rt ??= ManagedRuntime.make(layer, { memoMap });
		return rt.runPromise(service.use(fn), options);
	};
}
```

This gives each service module its own lazily initialized runtime while still sharing memoized layers.

### 2. Service modules own their full public surface

opencode's target shape is:

```ts
export namespace Foo {
	export interface Interface {
		readonly get: (id: FooID) => Effect.Effect<FooInfo, FooError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/Foo") {}

	export const layer = Layer.effect(
		Service,
		Effect.gen(function* () {
			const get = Effect.fn("Foo.get")(function* (id: FooID) {
				// ...
			});

			return Service.of({ get });
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(FooDep.layer));

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function get(id: FooID) {
		return runPromise((svc) => svc.get(id));
	}
}
```

### 3. Async facades only at non-Effect boundaries

The opencode pattern is not just "wrap everything in Effect". It keeps internal code Effect-first, then exposes plain `async function` facades where consumers are Promise-based.

### 4. Explicit service APIs instead of raw transport objects

For example, their services expose app methods, not just a naked HTTP client or vendor object.

### 5. Prefer Effect-native HTTP for owned transport code

They explicitly prefer `HttpClient.HttpClient` over ad hoc `fetch`.

---

## Current repo context

This repo is already partly aligned with that direction.

### Existing good foundations

#### Effect config already exists

- `packages/core/src/config.ts`
- `apps/api/src/config.ts`

Examples:

```ts
export const CoreAuthConfig = Config.all({
	baseUrl: Config.string("BASE_URL"),
	authBaseUrl: Config.option(Config.string("AUTH_BASE_URL")),
	githubClientId: Config.string("GITHUB_CLIENT_ID"),
	githubClientSecret: Config.redacted("GITHUB_CLIENT_SECRET"),
});
```

```ts
export const ApiConfig = Config.all({
	baseUrl: Config.string("BASE_URL"),
	port: Config.number("PORT"),
});
```

#### Service construction is already Layer-based

Current service modules are already close in shape:

- `packages/core/src/analytics/service.ts`
- `packages/core/src/drizzle/service.ts`
- `packages/core/src/email/service.ts`
- `packages/core/src/rate-limit/service.ts`
- `packages/core/src/auth/index.ts`
- `apps/api/src/middleware/auth-live.ts`

Examples:

```ts
export class EmailService extends ServiceMap.Service<EmailService, EmailServiceShape>()(
	"EmailService",
) {}

export const EmailServiceLive = Layer.effect(EmailService)(
	Effect.gen(function* () {
		// ...
	}),
);
```

```ts
export class RateLimitService extends ServiceMap.Service<RateLimitService, RateLimitServiceShape>()(
	"RateLimitService",
) {}
```

### Current gaps

#### Gap 1: no shared `makeRunPromise`

We do not currently have a shared helper like opencode's `run-service.ts`.

The clearest manual runtime is:

- `apps/web/src/clients/rpc.ts`

```ts
const runtime = ManagedRuntime.make(RpcProtocol);
```

#### Gap 2: production services still use bespoke `*ServiceLive` naming

Current names leak implementation details and do not match the desired pattern:

- `ClickHouseServiceLive`
- `DatabaseServiceLive`
- `EmailServiceLive`
- `RateLimitServiceLive`
- `AuthServiceLive`

These are wired in:

- `apps/api/src/runtime.ts`

```ts
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	EmailServiceLive,
	RateLimitServiceLive,
	AuthServiceLive.pipe(Layer.provide(DatabaseServiceLive), Layer.provide(EmailServiceLive)),
);
```

#### Gap 3: service modules are not one-file owning modules yet

Current split modules include:

- `packages/core/src/drizzle/service.ts`
- `packages/core/src/drizzle/index.ts`

where `index.ts` is just a thin re-export:

```ts
export {
	DatabaseService,
	DatabaseServiceLive,
	type DatabaseClient,
} from "@chevrotain/core/drizzle/service";
```

#### Gap 4: `Auth` still leaks a vendor object as its service surface

Current file:

- `packages/core/src/auth/index.ts`

Current surface:

```ts
export type Auth = ReturnType<typeof createAuthInstance>;

export class AuthService extends ServiceMap.Service<AuthService, Auth>()("AuthService") {}
```

That means consumers depend on the Better Auth object shape directly.

Examples:

- `apps/api/src/handlers/auth.ts`

```ts
const auth = yield * AuthService;
const response =
	yield *
	Effect.tryPromise({
		try: () => auth.handler(rawRequest),
		// ...
	});
```

- `apps/api/src/middleware/auth-live.ts`

```ts
const auth = yield * AuthService;
const session =
	yield *
	Effect.tryPromise({
		try: () =>
			auth.api.getSession({
				headers: new globalThis.Headers(request.headers as Record<string, string>),
			}),
		// ...
	});
```

This is exactly the kind of surface opencode is trying to avoid.

#### Gap 5: direct `Effect.runPromise(...)` at the wrong boundary

Current file:

- `packages/core/src/auth/index.ts`

Example:

```ts
await Effect.runPromise(
	email.send({
		from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
		to: user.email,
		subject: "Reset your Chevrotain password",
		html,
		text,
	}),
);
```

This should move behind an async facade owned by `Email`, not stay embedded in Better Auth callback glue.

#### Gap 6: our owned HTTP transport is not yet using the shared service-runtime pattern

Current file:

- `apps/web/src/clients/rpc.ts`

It already uses Effect HTTP, which is good:

```ts
import { FetchHttpClient } from "effect/unstable/http";
```

and:

```ts
const RpcProtocol = RpcClient.layerProtocolHttp({
	url: `${apiUrl}/api/rpc`,
}).pipe(Layer.provide([FetchHttpClient.layer, FetchRequestInitLive, RpcSerialization.layerNdjson]));
```

But it is still manually managed rather than following the namespaced service pattern.

#### Gap 7: implementation names leak into app-level code

Examples:

- `apps/api/src/handlers/rpc.ts` imports `ClickHouseService` and `RateLimitService`
- `apps/api/src/handlers/zero.ts` imports `DatabaseService`
- `apps/api/src/runtime.ts` imports all `*ServiceLive` modules directly

This means app code depends on implementation names rather than domain service names.

---

## Important non-problem: raw `fetch()` replacement is not the main work here

I did not find direct `fetch(` usage in our source tree.

The only clear owned outbound transport code I found is:

- `apps/web/src/clients/rpc.ts`

and that already uses Effect HTTP layers.

So this migration is **primarily a structural cleanup**, not a big "replace raw fetch with HttpClient" effort.

---

## Target repo convention

This repo should adopt the following standard service shape.

### Canonical structure

```ts
export namespace Foo {
	export interface Interface {
		readonly bar: (input: Input) => Effect.Effect<Output, FooError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Foo") {}

	export const layer = Layer.effect(
		Service,
		Effect.gen(function* () {
			const dep = yield* Dep.Service;

			const bar = Effect.fn("Foo.bar")(function* (input: Input) {
				return yield* dep.work(input);
			});

			return Service.of({ bar });
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(Dep.defaultLayer));

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function bar(input: Input) {
		return runPromise((svc) => svc.bar(input));
	}
}
```

### Naming rules

- prefer `Foo.Service`, not `FooService`
- prefer `Foo.layer`, not `FooServiceLive`
- use `Foo.defaultLayer` for dependency-wired variants
- use `Effect.fn("Foo.method")` for traced/named operations
- keep the whole public service surface in one owning module

### Boundary rule

Only add `runPromise` and async facades where needed:

- browser clients
- third-party callback APIs
- Promise-native edges
- tests/helpers when useful

Do **not** create Promise facades for purely internal Effect consumers just for symmetry.

### Vendor-surface rule

Do **not** expose third-party SDK instances as the service API.

Bad:

```ts
export class AuthService extends ServiceMap.Service<AuthService, BetterAuthInstance>()(
	"AuthService",
) {}
```

Good:

```ts
export namespace Auth {
	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: HeadersInit) => Effect.Effect<SessionData | null, AuthError>;
	}
}
```

### HTTP rule

For outbound HTTP that we own, prefer:

- `HttpClient.HttpClient`
- `HttpClientRequest`
- `HttpClientResponse`

Do not force-rewrite third-party SDK internals.

---

## Migration plan

## Phase 0: record the convention in-repo

### Action

Keep this document as the local migration plan and reference point.

### Why

Without a repo-local convention, service migrations will drift and each file will invent its own version of "Effect style".

---

## Phase 1: add shared runtime helper

### New file

- `packages/core/src/effect/run-service.ts`

### Target contents

```ts
import { Effect, Layer, ManagedRuntime } from "effect";
import * as ServiceMap from "effect/ServiceMap";

export const memoMap = Layer.makeMemoMapUnsafe();

export function makeRunPromise<I, S, E>(
	service: ServiceMap.Service<I, S>,
	layer: Layer.Layer<I, E>,
) {
	let rt: ManagedRuntime.ManagedRuntime<I, E> | undefined;

	return <A, Err>(fn: (svc: S) => Effect.Effect<A, Err, I>, options?: Effect.RunOptions) => {
		rt ??= ManagedRuntime.make(layer, { memoMap });
		return rt.runPromise(service.use(fn), options);
	};
}
```

### Goal

Make this the standard runtime helper across the repo.

### Success criteria

- no more ad hoc `ManagedRuntime.make(...)` in production service/client modules
- async facades go through `makeRunPromise`

---

## Phase 2: migrate the browser RPC transport first

### Current file

- `apps/web/src/clients/rpc.ts`

### Why first

It already has:

- a manual managed runtime
- Effect-native HTTP transport
- Promise-facing consumers

That makes it the best first concrete migration.

### Current shape

```ts
const runtime = ManagedRuntime.make(RpcProtocol);

export function ingestEvents(payload: AnalyticsPayload): Promise<void> {
	return runtime.runPromise(/* ... */);
}
```

### Target shape

```ts
export namespace RpcTransport {
	export interface Interface {
		readonly ingestEvents: (payload: AnalyticsPayload) => Effect.Effect<void>;
		readonly reportErrors: (payload: ErrorPayload) => Effect.Effect<void>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()(
		"@chevrotain/RpcTransport",
	) {}

	export const layer = Layer.effect(
		Service,
		Effect.gen(function* () {
			const client = yield* RpcClient.make(ChevrotainRpcs);

			const ingestEvents = Effect.fn("RpcTransport.ingestEvents")(function* (
				payload: AnalyticsPayload,
			) {
				yield* client.IngestEvents(payload);
			});

			const reportErrors = Effect.fn("RpcTransport.reportErrors")(function* (
				payload: ErrorPayload,
			) {
				yield* client.ReportErrors(payload);
			});

			return Service.of({ ingestEvents, reportErrors });
		}),
	);

	export const defaultLayer = layer.pipe(
		Layer.provide(RpcClient.layerProtocolHttp({ url: `${apiUrl}/api/rpc` })),
		Layer.provide(FetchHttpClient.layer),
		Layer.provide(FetchRequestInitLive),
		Layer.provide(RpcSerialization.layerNdjson),
	);

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function ingestEvents(payload: AnalyticsPayload): Promise<void> {
		return runPromise((svc) => svc.ingestEvents(payload));
	}

	export async function reportErrors(payload: ErrorPayload): Promise<void> {
		return runPromise((svc) => svc.reportErrors(payload));
	}
}
```

### Notes

- keep the exported functions so callers do not churn
- the service/module name can be `RpcTransport`, `RpcClientService`, or similar, but it should describe our domain role, not the library type
- the runtime disposal-on-HMR behavior may need to be reconsidered after the helper exists; if we need explicit teardown for HMR we can either keep it local or extend the helper later

---

## Phase 3: normalize leaf core services into domain-owned namespaces

These are already close structurally and should become the standard examples.

## Phase 3a: analytics

### Current file

- `packages/core/src/analytics/service.ts`

### Current issues

- implementation-driven naming: `ClickHouseService`
- implementation-driven layer name: `ClickHouseServiceLive`
- domain code imports implementation name directly

### Consumers

- `apps/api/src/handlers/rpc.ts`
- `apps/api/src/runtime.ts`
- `apps/api/src/handlers/analytics.test.ts`

### Target

Move to:

- `packages/core/src/analytics/index.ts`
- namespace: `Analytics`

### Target surface

```ts
export namespace Analytics {
	export interface Interface {
		readonly insertEvents: (
			events: AnalyticsEvent[],
			userId: string,
			sessionId: string,
		) => Effect.Effect<void, ClickHouseError>;
		readonly insertErrors: (errors: ErrorEventRow[]) => Effect.Effect<void, ClickHouseError>;
	}
}
```

### Important detail

It is fine for ClickHouse to remain an implementation detail inside `Analytics.layer`. The public service name should be domain-centric.

---

## Phase 3b: database

### Current files

- `packages/core/src/drizzle/service.ts`
- `packages/core/src/drizzle/index.ts`

### Current issues

- split ownership across `service.ts` and a thin re-export file
- implementation-style naming leaks everywhere

### Consumers

- `apps/api/src/handlers/zero.ts`
- `apps/api/src/runtime.ts`
- `packages/core/src/auth/index.ts`
- `packages/core/src/billing/webhooks.ts`

### Target

Collapse into:

- `packages/core/src/drizzle/index.ts`
- namespace: `Database`

### Target surface options

#### Option A: explicit db property

```ts
export namespace Database {
	export interface Interface {
		readonly db: DatabaseClient;
	}
}
```

Callers:

```ts
const { db } = yield * Database.Service;
```

#### Option B: explicit accessor method

```ts
export namespace Database {
	export interface Interface {
		readonly get: () => Effect.Effect<DatabaseClient>;
	}
}
```

### Recommendation

Use **Option A** unless the library ergonomics make that painful. It keeps the service simple while still hiding the implementation module structure.

---

## Phase 3c: email

### Current file

- `packages/core/src/email/service.ts`

### Current issues

- `EmailServiceLive` naming
- no async facade for Promise-based callback consumers

### Consumers

- `packages/core/src/auth/index.ts`
- `apps/api/src/runtime.ts`

### Target

Move to:

- `packages/core/src/email/index.ts`
- namespace: `Email`

### Target surface

```ts
export namespace Email {
	export interface Interface {
		readonly send: (params: {
			from: string;
			to: string;
			subject: string;
			html: string;
			text: string;
		}) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
	}

	// ... layer/defaultLayer ...

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function send(params: Params) {
		return runPromise((svc) => svc.send(params));
	}
}
```

### Why it matters

This lets `Auth` call `await Email.send(...)` instead of embedding `Effect.runPromise(...)` in Better Auth callback glue.

---

## Phase 3d: rate limit

### Current file

- `packages/core/src/rate-limit/service.ts`

### Current issues

- `RateLimitServiceLive` naming
- raw `Date.now()`/`setInterval()` state is fine for now, but the service shape should be normalized

### Consumers

- `apps/api/src/handlers/rpc.ts`
- `apps/api/src/runtime.ts`

### Target

Move to:

- `packages/core/src/rate-limit/index.ts`
- namespace: `RateLimit`

### Target surface

```ts
export namespace RateLimit {
	export interface Interface {
		readonly check: (key: string, message?: string) => Effect.Effect<void, RateLimitError>;
	}
}
```

### Note

No Promise facade unless we actually need one.

---

## Phase 4: full `Auth` refactor

This is the most important migration step.

### Current file

- `packages/core/src/auth/index.ts`

### Current issues

1. the service surface is the raw Better Auth instance
2. callers reach through vendor APIs directly
3. password reset callback uses `Effect.runPromise(...)`
4. app code is tightly coupled to Better Auth object shape

### Current consumers

- `apps/api/src/handlers/auth.ts`
- `apps/api/src/middleware/auth-live.ts`
- `apps/api/src/runtime.ts`

### Current examples of leaking vendor surface

#### `apps/api/src/handlers/auth.ts`

```ts
const auth = yield * AuthService;
const response =
	yield *
	Effect.tryPromise({
		try: () => auth.handler(rawRequest),
		// ...
	});
```

#### `apps/api/src/middleware/auth-live.ts`

```ts
const auth = yield * AuthService;
const session =
	yield *
	Effect.tryPromise({
		try: () =>
			auth.api.getSession({
				headers: new globalThis.Headers(request.headers as Record<string, string>),
			}),
		// ...
	});
```

### Target

Keep `packages/core/src/auth/index.ts`, but change it into a proper namespaced domain service.

### Proposed target surface

```ts
export namespace Auth {
	export interface SessionData {
		readonly user: User;
		readonly session: Session;
	}

	export class AuthError extends Schema.TaggedErrorClass<AuthError>()("AuthError", {
		message: Schema.String,
		cause: Schema.optional(Schema.Defect),
	}) {}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: HeadersInit) => Effect.Effect<SessionData | null, AuthError>;
	}
}
```

### Implementation direction

- build the Better Auth instance once inside `Auth.layer`
- keep it private inside the layer implementation
- wrap `handler` and `api.getSession` as named `Effect.fn(...)` operations
- decode/normalize returned session data inside the service
- stop exporting `ReturnType<typeof createAuthInstance>` as the public type

### Example target sketch

```ts
export namespace Auth {
	export interface SessionData {
		readonly user: User;
		readonly session: Session;
	}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: HeadersInit) => Effect.Effect<SessionData | null, AuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Auth") {}

	export const layer = Layer.effect(
		Service,
		Effect.gen(function* () {
			const authConfig = yield* CoreAuthConfig;
			const billingConfig = yield* CoreBillingConfig;
			const { db } = yield* Database.Service;

			const auth = createAuthInstance(authConfig, billingConfig, db, {
				send: (params) => Effect.promise(() => Email.send(params)),
			});

			const handle = Effect.fn("Auth.handle")((request: Request) =>
				Effect.tryPromise({
					try: () => auth.handler(request),
					catch: (cause) => new AuthError({ message: "Auth handler failed", cause }),
				}),
			);

			const getSession = Effect.fn("Auth.getSession")((headers: HeadersInit) =>
				Effect.tryPromise({
					try: () => auth.api.getSession({ headers: new Headers(headers) }),
					catch: (cause) => new AuthError({ message: "Auth getSession failed", cause }),
				}).pipe(
					Effect.flatMap((raw) =>
						raw
							? Effect.all({
									user: Schema.decodeUnknownEffect(User)(raw.user),
									session: Schema.decodeUnknownEffect(Session)(raw.session),
								})
							: Effect.succeed(null),
					),
				),
			);

			return Service.of({ handle, getSession });
		}),
	);
}
```

### Immediate downstream simplification

#### `apps/api/src/handlers/auth.ts`

Current:

```ts
const auth = yield * AuthService;
// use auth.handler(...)
```

Target:

```ts
const auth = yield * Auth.Service;
const response = yield * auth.handle(rawRequest);
```

#### `apps/api/src/middleware/auth-live.ts`

Current:

```ts
const auth = yield* AuthService
const session = yield* Effect.tryPromise({
  try: () => auth.api.getSession({ headers: ... }),
})
```

Target:

```ts
const auth = yield * Auth.Service;
const session =
	yield * auth.getSession(new globalThis.Headers(request.headers as Record<string, string>));
```

This is the clearest sign that the service boundary has been cleaned up properly.

---

## Phase 5: update API code to consume the new service shapes

## Phase 5a: runtime composition

### Current file

- `apps/api/src/runtime.ts`

### Current shape

```ts
export const AppLayer = Layer.mergeAll(
	DatabaseServiceLive,
	ClickHouseServiceLive,
	EmailServiceLive,
	RateLimitServiceLive,
	AuthServiceLive.pipe(Layer.provide(DatabaseServiceLive), Layer.provide(EmailServiceLive)),
);
```

### Target shape

```ts
export const AppLayer = Layer.mergeAll(
	Database.layer,
	Analytics.layer,
	Email.layer,
	RateLimit.layer,
	Auth.defaultLayer,
);
```

or, if some services need dependency-wired variants:

```ts
export const AppLayer = Layer.mergeAll(
	Database.layer,
	Analytics.defaultLayer,
	Email.layer,
	RateLimit.layer,
	Auth.defaultLayer,
);
```

### Goal

The composition root should talk in terms of standardized service namespaces, not bespoke `*ServiceLive` exports.

---

## Phase 5b: RPC handler imports

### Current file

- `apps/api/src/handlers/rpc.ts`

### Current imports

```ts
import { ClickHouseService } from "@chevrotain/core/analytics/service";
import { RateLimitService } from "@chevrotain/core/rate-limit/service";
```

### Target imports

```ts
import { Analytics } from "@chevrotain/core/analytics";
import { RateLimit } from "@chevrotain/core/rate-limit";
```

### Target usage

```ts
const analytics = yield * Analytics.Service;
const rateLimit = yield * RateLimit.Service;
```

---

## Phase 5c: Zero handler imports

### Current file

- `apps/api/src/handlers/zero.ts`

### Current import

```ts
import { DatabaseService } from "@chevrotain/core/drizzle/service";
```

### Target import

```ts
import { Database } from "@chevrotain/core/drizzle";
```

### Target usage

Depending on the chosen Database shape:

```ts
const { db } = yield * Database.Service;
```

or:

```ts
const database = yield * Database.Service;
const db = yield * database.get();
```

---

## Phase 5d: auth middleware and handler

### Files

- `apps/api/src/handlers/auth.ts`
- `apps/api/src/middleware/auth-live.ts`

### Goal

These files should depend only on explicit app-level auth methods, not the Better Auth vendor object.

---

## Phase 6: remove old implementation-shaped exports

Once the new namespace modules are in place, remove:

- `ClickHouseService`
- `ClickHouseServiceLive`
- `DatabaseService`
- `DatabaseServiceLive`
- `EmailService`
- `EmailServiceLive`
- `RateLimitService`
- `RateLimitServiceLive`
- `AuthService`
- `AuthServiceLive`

Also remove thin re-export shims that only preserve the old naming.

---

## File-by-file execution order

Recommended implementation order:

1. `packages/core/src/effect/run-service.ts`
2. `apps/web/src/clients/rpc.ts`
3. `packages/core/src/email/index.ts`
4. `packages/core/src/auth/index.ts`
5. `apps/api/src/handlers/auth.ts`
6. `apps/api/src/middleware/auth-live.ts`
7. `packages/core/src/analytics/index.ts`
8. `packages/core/src/drizzle/index.ts`
9. `packages/core/src/rate-limit/index.ts`
10. `apps/api/src/handlers/rpc.ts`
11. `apps/api/src/handlers/zero.ts`
12. `apps/api/src/runtime.ts`
13. delete old `service.ts` files and stale imports

### Why this order

- Phase 1 gives us the shared primitive.
- RPC is the easiest first real conversion.
- Email before Auth removes the awkward `Effect.runPromise(...)` boundary.
- Auth is the highest-value domain surface cleanup.
- The remaining service renames then become mostly mechanical.

---

## Concrete examples of the intended end state

## Example: email before vs after

### Before

`packages/core/src/email/service.ts`

```ts
export class EmailService extends ServiceMap.Service<EmailService, EmailServiceShape>()(
	"EmailService",
) {}

export const EmailServiceLive = Layer.effect(EmailService)(
	Effect.gen(function* () {
		// ...
	}),
);
```

### After

```ts
export namespace Email {
	export interface Interface {
		readonly send: (params: SendParams) => Effect.Effect<CreateEmailResponseSuccess, EmailError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Email") {}

	export const layer = Layer.effect(
		Service,
		Effect.gen(function* () {
			const resendApiKey = yield* Config.redacted("RESEND_API_KEY");
			const resend = new Resend(Redacted.value(resendApiKey));

			const send = Effect.fn("Email.send")((params: SendParams) =>
				Effect.tryPromise({
					try: () => resend.emails.send(params),
					catch: (cause) => new EmailError({ message: "Resend API request failed", cause }),
				}).pipe(
					Effect.flatMap((result) =>
						result.error || !result.data
							? Effect.fail(
									new EmailError({
										message: result.error?.message ?? "Email sent but received no response data",
									}),
								)
							: Effect.succeed(result.data),
					),
				),
			);

			return Service.of({ send });
		}),
	);

	export const defaultLayer = layer;

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function send(params: SendParams) {
		return runPromise((svc) => svc.send(params));
	}
}
```

## Example: auth callback boundary after Email migration

### Before

```ts
await Effect.runPromise(
	email.send({
		from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
		to: user.email,
		subject: "Reset your Chevrotain password",
		html,
		text,
	}),
);
```

### After

```ts
await Email.send({
	from: "Chevrotain <no-reply@chevrotain.schmatzler.com>",
	to: user.email,
	subject: "Reset your Chevrotain password",
	html,
	text,
});
```

The boundary becomes simpler and the runtime ownership moves into the Email module where it belongs.

## Example: middleware after Auth surface cleanup

### Before

```ts
const auth = yield* AuthService
const session = yield* Effect.tryPromise({
  try: () =>
    auth.api.getSession({
      headers: new globalThis.Headers(request.headers as Record<string, string>),
    }),
  catch: // ...
})
```

### After

```ts
const auth = yield * Auth.Service;
const session =
	yield * auth.getSession(new globalThis.Headers(request.headers as Record<string, string>));
```

This is shorter, clearer, and hides Better Auth internals from the API layer.

---

## Decisions captured here

1. Use a shared `makeRunPromise` helper in `@chevrotain/core`, including for web-side service/runtime modules.
2. Do the **full** service-boundary cleanup, not just a superficial structural rename.
3. Narrow `Auth` away from the raw Better Auth instance.
4. Standardize names around namespaces and `layer/defaultLayer`.
5. Treat owned HTTP transport as Effect HTTP code.
6. Do **not** import opencode's `InstanceState` patterns into this repo unless a future problem actually requires them.

---

## Definition of done

This migration is structurally successful when all of the following are true:

- `packages/core/src/effect/run-service.ts` exists and is the standard helper
- `apps/web/src/clients/rpc.ts` no longer creates its own runtime directly
- production code no longer imports `*ServiceLive`
- core services expose namespace-owned modules with `Service`, `layer`, and optional `defaultLayer`
- `Auth` no longer exposes the raw Better Auth object as its service shape
- `apps/api/src/handlers/auth.ts` uses `Auth.handle(...)`
- `apps/api/src/middleware/auth-live.ts` uses `Auth.getSession(...)`
- `packages/core/src/auth/index.ts` no longer calls `Effect.runPromise(...)` directly
- implementation names like `ClickHouseService` stop leaking into app-level imports
- owned outbound HTTP code uses the shared Effect service/runtime pattern

---

## Non-goals for this attempt

- introducing `InstanceState`
- inventing per-directory scoped services
- rewriting third-party SDK internals to pure `HttpClient`
- adding Promise facades for every internal service whether needed or not
- large no-value churn that only renames without improving boundaries
