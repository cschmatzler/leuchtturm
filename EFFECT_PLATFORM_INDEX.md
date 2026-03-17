# @effect/platform HttpApi System - Research Index

## Documentation Files

This research contains two comprehensive documents about @effect/platform's HttpApi system for Effect v4:

### 1. EFFECT_PLATFORM_QUICK_START.md (351 lines)

**Best for:** Getting started quickly, seeing practical examples

- 30-second overview
- Minimal working example
- Core concepts visualization
- 10+ common patterns with code
- Response types reference
- Error handling patterns
- Type-safe client examples
- Common gotchas

**Start here if:** You want to implement something right now

### 2. EFFECT_PLATFORM_RESEARCH.md (1045 lines)

**Best for:** Deep understanding, reference during implementation

- Complete architecture overview with diagrams
- 11 detailed sections (API definition, handlers, middleware, etc.)
- Full code examples for every feature
- Integration patterns (services, databases)
- Security schemes (Bearer, API Key, Basic Auth)
- Advanced patterns (multipart uploads, streaming, etc.)
- CORS configuration details
- OpenTelemetry integration
- Client generation
- Comparison with Hono
- Limitations and workarounds
- Complete example projects

**Start here if:** You want comprehensive understanding before implementing

## Quick Reference

### File Organization

```
@effect/platform/
├── HttpApi.ts                 # API definition
├── HttpApiGroup.ts            # Endpoint grouping
├── HttpApiEndpoint.ts         # Individual endpoints
├── HttpApiBuilder.ts          # Handler implementation
├── HttpApiMiddleware.ts       # Middleware system
├── HttpApiSecurity.ts         # Security schemes
├── HttpApiSchema.ts           # Schema utilities
├── HttpRouter.ts              # Route matching (low-level)
├── HttpServer.ts              # Server interface
├── HttpApp.ts                 # Effect-based app
├── HttpServerRequest.ts       # Request object
├── HttpServerResponse.ts      # Response helpers
├── HttpApiClient.ts           # Type-safe client
├── HttpApiSwagger.ts          # Swagger/OpenAPI
└── OpenApi.ts                 # OpenAPI generation

@effect/platform-node/
├── NodeHttpServer.ts          # Node.js adapter
├── NodeHttpClient.ts          # Node.js HTTP client
└── NodeContext.ts             # Node.js context
```

### Core Imports

```typescript
// API Definition
import {
	HttpApi,
	HttpApiGroup,
	HttpApiEndpoint,
	HttpApiSchema,
	HttpApiError,
} from "@effect/platform";

// Implementation
import { HttpApiBuilder } from "@effect/platform";

// Middleware & Security
import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform";

// Server
import { HttpServer, HttpRouter, HttpApp } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";

// Types
import { HttpServerRequest, HttpServerResponse } from "@effect/platform";

// Client
import { HttpApiClient } from "@effect/platform";

// Documentation
import { HttpApiSwagger, OpenApi } from "@effect/platform";

// Core Effect
import { Effect, Layer, Context, Schema } from "effect";
```

## The Pattern (In 3 Steps)

### Step 1: DEFINE

```typescript
class MyApi extends HttpApi.make("api") {}

class GetUser extends HttpApiEndpoint.make("GetUser")(
  "GET", "/users/:id"
)(
  Schema.Struct({ id: Schema.String })  // Path params
)(
  Schema.Struct({ id: Schema.String, name: Schema.String })  // Response
)

class Users extends HttpApiGroup.makeRoute("Users", MyApi).add(GetUser)
class Api extends MyApi.add(Users)
```

### Step 2: IMPLEMENT

```typescript
const ApiLive = HttpApiBuilder.group(Api, "Users", (handlers) =>
	handlers.handle("GetUser", ({ path }) =>
		Effect.gen(function* () {
			return { id: path.id, name: "Example" };
		}),
	),
);
```

### Step 3: SERVE

```typescript
const ServerLive = Layer.mergeAll(
	NodeHttpServer.layer(() => new http.Server(), { port: 3000 }),
	ApiLive,
	HttpApiBuilder.api(Api),
	HttpApiBuilder.serve(),
);

Effect.runPromise(Effect.scoped(Effect.void).pipe(Effect.provide(ServerLive)));
```

## Key Features at a Glance

| Feature                                | Support | Documentation |
| -------------------------------------- | ------- | ------------- |
| Path parameters                        | ✓       | RESEARCH #1   |
| Query parameters                       | ✓       | RESEARCH #1   |
| Request body                           | ✓       | RESEARCH #1   |
| Headers                                | ✓       | RESEARCH #1   |
| Multiple response statuses             | ✓       | RESEARCH #1   |
| Error handling                         | ✓       | RESEARCH #4   |
| Raw request access                     | ✓       | RESEARCH #6   |
| Middleware (global/group/endpoint)     | ✓       | RESEARCH #3   |
| Security schemes (Bearer/ApiKey/Basic) | ✓       | RESEARCH #3   |
| File uploads (multipart)               | ✓       | RESEARCH #2   |
| Service integration                    | ✓       | RESEARCH #2   |
| CORS                                   | ✓       | RESEARCH #7   |
| OpenTelemetry                          | ✓       | RESEARCH #8   |
| Type-safe client                       | ✓       | RESEARCH #9   |
| OpenAPI/Swagger generation             | ✓       | RESEARCH #9   |

## Handler Patterns

### Standard Handler

```typescript
.handle("EndpointName", ({ path, urlParams, payload, headers, request }) =>
  Effect.gen(function* () {
    // path?: PathType (from setPath)
    // urlParams?: UrlParamsType (from setUrlParams)
    // payload?: PayloadType (from setPayload)
    // headers?: HeadersType (from setHeaders)
    // request: HttpServerRequest (raw request)

    return { /* response matching schema */ }
  })
)
```

### Raw Handler (for webhooks, catch-alls)

```typescript
.handleRaw("WebhookHandler", ({ request }) =>
  Effect.gen(function* () {
    const rawBody = yield* request.arrayBuffer
    // Full access to request

    return HttpServerResponse.raw({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true })
    })
  })
)
```

## Error Handling

### Three Ways to Signal Error

1. **Throw** (caught and encoded)

   ```typescript
   if (!found) throw new Error("NOT_FOUND");
   ```

2. **Effect.fail** (Effect-style)

   ```typescript
   if (!found) return yield * Effect.fail(new NotFoundError());
   ```

3. **Return error-shaped object**
   ```typescript
   if (!found) return { code: "NOT_FOUND" as const };
   ```

### Status Codes

- 200: Success with body
- 204: Success with void body
- 400: Schema validation error (automatic)
- 404: Route not found (automatic)
- Custom: Via `.addError(..., { status: n })`
- 500: Unhandled error (automatic)

## Middleware

### Levels

1. **API-wide**: `MyApi.middleware(Auth)`
2. **Group-level**: `MyApiGroup.middleware(Auth)`
3. **Endpoint-level**: `Endpoint.middleware(Auth)`

### Security Middleware

```typescript
class Auth extends HttpApiMiddleware.makeSecure("Auth")({
	Bearer: (token) => Effect.succeed({ userId: "..." }),
	ApiKey: (key) => Effect.succeed({ userId: "..." }),
}) {}
```

### Optional Middleware

```typescript
class OptionalAuth extends HttpApiMiddleware.make("OptionalAuth")<
  { user?: User },
  never,
  { optional: true }
>(...) {}
```

## CORS Configuration

```typescript
HttpMiddleware.cors({
	allowedOrigins: [], // Empty = allow all
	// OR: ["https://example.com"]

	allowedMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],

	allowedHeaders: [], // Empty = reflect client headers
	// OR: ["authorization", "content-type"]

	credentials: true,
	maxAge: 600,
});
```

## Service Integration

```typescript
class Database extends Context.Tag("Database")<
  Database,
  { query: <T>(sql: string) => Effect.Effect<T> }
>() {}

.handle("GetUser", ({ path }) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* db.query(`SELECT * FROM users WHERE id = ?`, [path.id])
  })
)
```

## Versions

- **@effect/platform**: v0.95.0 (latest from repo)
- **effect**: v4.0.0-beta.33 (your project)
- **@effect/platform-node**: Matches @effect/platform version

## Source Code Locations

```
effect repo:
/home/cschmatzler/.local/share/opensrc/repos/github.com/effect-ts/effect

Key files:
├── packages/platform/src/
│   ├── HttpApi.ts
│   ├── HttpApiEndpoint.ts
│   ├── HttpApiBuilder.ts
│   ├── HttpApiMiddleware.ts
│   └── ... (30+ files)
│
├── packages/platform-node/src/
│   ├── NodeHttpServer.ts
│   └── ... (Node.js adapters)
│
└── packages/platform/test/
    └── HttpApiBuilder.test.ts (real examples)
```

## Common Gotchas

1. **Catch-all routes**: Use `handleRaw()` with `"/auth/*"` pattern
2. **Router composition**: Use `addHttpApi()` + `prefix()`, not separate instances
3. **Dynamic routing**: Routes are static; wrap dynamic logic in Effect
4. **Error complexity**: API + Group + Endpoint + Middleware = error unions
5. **CORS permissive default**: Empty arrays allow everything
6. **Multipart streaming**: Limited support; use `handleRaw()` for large files

## Next Steps

1. **Start small**: Read QUICK_START.md, run the minimal example
2. **Explore patterns**: Pick a feature from common patterns
3. **Deep dive**: Read RESEARCH.md section for that feature
4. **Integrate**: Connect to your database/services
5. **Reference**: Keep RESEARCH.md nearby during implementation

## Integration with Your Project (chevrotain)

Currently using Hono. If considering @effect/platform:

**Pros:**

- Schema-first matches your architecture
- Type-safe by default (no hc client needed)
- Natural Effect integration
- Built-in error handling structure

**Key changes:**

- Replace Hono app with HttpApi
- Replace middleware pattern with HttpApiMiddleware
- Replace better-auth handler with `handleRaw("/auth/*")`
- Keep DatabaseService/ClickHouseService (just `yield*` them)
- Replace `.route()` with `.add(Group)`

## License & Attribution

- Source: `/home/cschmatzler/.local/share/opensrc/repos/github.com/effect-ts/effect`
- Package: @effect/platform (MIT License)
- Research compiled: March 17, 2026

---

**For questions**: See EFFECT_PLATFORM_RESEARCH.md (Section 11 has complete example)
**For quick answers**: See EFFECT_PLATFORM_QUICK_START.md (10+ patterns)
