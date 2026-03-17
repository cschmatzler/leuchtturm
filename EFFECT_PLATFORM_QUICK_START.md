# @effect/platform HttpApi - Quick Start Guide

## Installation

```bash
npm install @effect/platform @effect/platform-node effect
```

## 30-Second Overview

@effect/platform is a **declarative, type-safe HTTP API framework** for Effect v4. Define your API schema once, implement handlers once, get type-safe clients, error handling, middleware, and OpenAPI docs automatically.

### Philosophy

1. **Define**: Schema-first API definition (endpoints, payloads, errors)
2. **Implement**: Handler functions that return Effects
3. **Serve**: Automatic routing, error handling, middleware composition
4. **Use**: Type-safe client generation

## Minimal Example

```typescript
import { HttpApi, HttpApiEndpoint, HttpApiBuilder, Schema, Effect } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import http from "http"

// 1. DEFINE: Create API with endpoints
class MyApi extends HttpApi.make("api") {}

const GetItem = HttpApiEndpoint.make("GetItem")(
  "GET",
  "/items/:id"
)(
  Schema.Struct({ id: Schema.String })
)(
  Schema.Struct({ id: Schema.String, name: Schema.String })
)

class Items extends HttpApi.makeGroup("Items", MyApi).add(GetItem)
class Api extends MyApi.add(Items)

// 2. IMPLEMENT: Add handlers
const ApiLive = HttpApiBuilder.group(Api, "Items", (handlers) =>
  handlers.handle("GetItem", ({ path }) =>
    Effect.succeed({ id: path.id, name: "Example" })
  )
)

// 3. SERVE: Start server
const ServerLive = Layer.mergeAll(
  NodeHttpServer.layer(() => new http.Server(), { port: 3000 }),
  ApiLive,
  HttpApiBuilder.api(Api),
  HttpApiBuilder.serve()
)

Effect.runPromise(Effect.scoped(Effect.void).pipe(Effect.provide(ServerLive)))
```

## Core Concepts

### API Structure

```
HttpApi
├── HttpApiGroup
│   ├── HttpApiEndpoint (GET /users/:id)
│   ├── HttpApiEndpoint (POST /users)
│   └── HttpApiEndpoint (DELETE /users/:id)
└── HttpApiGroup
    └── HttpApiEndpoint
```

### Endpoint Definition

```typescript
HttpApiEndpoint.make("EndpointName")(
  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD"
  "/path/:paramName"
)(
  Schema.Struct({ paramName: Schema.String })  // Path params
)(
  Schema.Struct({ ... })  // Success response
)
.setPayload(Schema.Struct({ ... }))  // Request body
.setHeaders(Schema.Struct({ ... }))  // Request headers
.setUrlParams(Schema.Struct({ ... }))  // Query params
.addError(ErrorSchema, { status: 404 })  // Error responses
```

### Handler Signature

```typescript
.handle("EndpointName", ({ path, urlParams, payload, headers, request }) =>
  Effect.gen(function* () {
    // Perform operation
    return { id: "...", result: "..." }
  })
)

// OR for raw access:
.handleRaw("EndpointName", ({ request }) =>
  Effect.gen(function* () {
    const body = yield* request.arrayBuffer
    return HttpServerResponse.raw({ status: 200, body: "..." })
  })
)
```

## Common Patterns

### Path Parameters

```typescript
const GetUser = HttpApiEndpoint.make("GetUser")(
	"GET",
	"/users/:id", // :id becomes parameter
)(Schema.Struct({ id: Schema.String }));
```

### Query Parameters (for GET/HEAD)

```typescript
const ListUsers = HttpApiEndpoint.make("ListUsers")("GET", "/users")(
	Schema.Struct({
		skip: Schema.optional(Schema.Number),
		take: Schema.optional(Schema.Number),
	}),
);
```

### Request Body (for POST/PUT/PATCH)

```typescript
const CreateUser = HttpApiEndpoint.make("CreateUser")("POST", "/users")(
	Schema.Struct({ name: Schema.String, email: Schema.String }),
);
```

### Multiple Error Responses

```typescript
const GetUser = HttpApiEndpoint.make("GetUser")(
	"GET",
	"/users/:id",
)(Schema.Struct({ id: Schema.String }))(UserResponse)
	.addError(Schema.Struct({ code: Schema.Literal("NOT_FOUND") }), { status: 404 })
	.addError(Schema.Struct({ code: Schema.Literal("FORBIDDEN") }), { status: 403 });
```

### Middleware (Auth Example)

```typescript
class AuthMiddleware extends HttpApiMiddleware.make("Auth")<
  { userId: string }
>(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const token = request.headers.authorization?.replace("Bearer ", "")
    if (!token) throw new Error("Unauthorized")
    return { userId: yield* verifyToken(token) }
  })
) {}

class Api extends MyApi.middleware(AuthMiddleware)
```

### Database Integration

```typescript
class Database extends Context.Tag("Database")<
  Database,
  { query: <T>(sql: string) => Effect.Effect<T> }
>() {}

.handle("GetUser", ({ path }) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* db.query(`SELECT * FROM users WHERE id = $1`, [path.id])
  })
)

// When serving:
const ApiLive = Layer.provide(ApiImplementation, DatabaseLive)
```

### Raw Request Handling (for webhooks, auth handlers)

```typescript
const AuthHandler = HttpApiEndpoint.make("AuthHandler")(
  "*",  // Any method
  "/auth/*"  // Any path under /auth
)(void)(void)

.handleRaw("AuthHandler", ({ request }) =>
  Effect.gen(function* () {
    // Access raw body
    const body = yield* request.arrayBuffer

    // Handle and return response
    return HttpServerResponse.raw({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true })
    })
  })
)
```

### CORS

```typescript
HttpApiBuilder.serve((app) =>
	app.pipe(
		HttpMiddleware.cors({
			allowedOrigins: [], // Empty = allow all
			// OR: ["https://example.com"]

			allowedMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
			allowedHeaders: [], // Empty = allow all client headers
			credentials: true,
			maxAge: 600,
		}),
	),
);
```

## Response Types

### Standard Response (type-safe)

```typescript
return { id: "123", name: "Bean" }; // Auto-encoded per schema
```

### Custom Status/Headers (HttpServerResponse)

```typescript
import { HttpServerResponse } from "@effect/platform";

return HttpServerResponse.json({ id: "123" }, { status: 201 });
return HttpServerResponse.text("Created", { status: 201 });
return HttpServerResponse.empty({ status: 204 });
return HttpServerResponse.redirect("/path", { status: 302 });
return HttpServerResponse.raw({
	status: 200,
	headers: { "x-custom": "value" },
	body: "raw text",
});
```

## Error Handling

### Schema Validation Error (automatic)

Returns 400 with validation details if request doesn't match schema.

### Handler Errors

```typescript
// Option 1: Throw (caught and encoded to error schema)
if (!resource) throw new Error("NOT_FOUND");

// Option 2: Effect.fail
yield * Effect.fail(new NotFoundError());

// Option 3: Custom error matching schema
if (!resource) return { code: "NOT_FOUND" as const, status: 404 };
```

### Error Schema Propagation

- API-level errors: Available for all endpoints
- Group-level errors: Available for all endpoints in group
- Endpoint-level errors: Only for that endpoint
- Middleware errors: Added to all protected endpoints

## Type-Safe Client

```typescript
const client = yield * HttpApiClient.make(MyApi);

const user =
	yield *
	client.GetUser({
		path: { id: "123" },
		headers: { authorization: "Bearer ..." },
	});

const users =
	yield *
	client.ListUsers({
		urlParams: { skip: 0, take: 10 },
	});

const newUser =
	yield *
	client.CreateUser({
		payload: { name: "Alice", email: "alice@example.com" },
	});
```

## Gotchas & Limitations

1. **Catch-all routes**: Use `handleRaw()` for `/*` patterns
2. **Sub-router mounting**: Use `addHttpApi()` + `prefix()`, not separate router instances
3. **Dynamic routes**: Routes defined at schema-definition time; dynamic routes require wrapper Effect
4. **Error complexity**: Each level (API/Group/Endpoint) + middleware creates union; keep error schemas simple
5. **CORS headers**: Default is permissive (empty arrays allow all); restrictive configs need specific values

## Complete Project Structure

```typescript
// api.ts - Define the API schema
export class MyApi extends HttpApi.make("myapi") {}
export class UsersGroup extends HttpApiGroup.makeRoute("Users", MyApi)
  .add(GetUser)
  .add(ListUsers)
  .add(CreateUser)
export class Api extends MyApi.add(UsersGroup)

// handlers.ts - Implement handlers
export const ApiLive = HttpApiBuilder.group(Api, "Users", (handlers) =>
  handlers
    .handle("GetUser", ({ path }) => ...)
    .handle("ListUsers", ({ urlParams }) => ...)
    .handle("CreateUser", ({ payload }) => ...)
)

// server.ts - Start server
const ServerLive = Layer.mergeAll(
  NodeHttpServer.layer(() => new http.Server(), { port: 3000 }),
  ApiLive,
  HttpApiBuilder.api(Api),
  HttpApiBuilder.serve()
)

Effect.runPromise(Effect.scoped(Effect.void).pipe(Effect.provide(ServerLive)))
```

## Further Reading

See `EFFECT_PLATFORM_RESEARCH.md` for:

- Detailed API definitions and examples
- Advanced middleware patterns
- Security schemes (Bearer, API Key, Basic Auth)
- File upload handling (multipart)
- OpenAPI/Swagger generation
- Performance optimization
- Testing patterns
