# @effect/platform HttpApi System - Comprehensive Research

## Overview

@effect/platform (v4.0.0-beta.33, previously v0.95.0+) provides a **fully type-safe, composable HTTP API system** for Effect v4. It's a declarative alternative to traditional routing frameworks, with powerful middleware, security, error handling, and OpenAPI generation built-in.

### Key Philosophy

- **Declare, Don't Implement**: Define your API schema first, then implement handlers
- **Type Safety**: Full end-to-end type safety from schema definitions to handler implementations
- **Composability**: APIs, groups, endpoints, and middleware all compose cleanly
- **Effect-native**: Handlers are Effects, enabling async composition and dependency injection
- **Auto-documentation**: Generate OpenAPI/Swagger from the schema

## Package Structure

```
@effect/platform                 # Core HTTP API system
@effect/platform-node            # Node.js HTTP server adapter
@effect/platform-bun             # Bun.sh HTTP server adapter
@effect/platform-browser         # Browser (Fetch API) client adapter
```

### Core Exports from @effect/platform

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

// Server/Router (low-level)
import { HttpServer, HttpRouter, HttpApp } from "@effect/platform";

// Client (type-safe)
import { HttpApiClient } from "@effect/platform";

// Documentation
import { HttpApiSwagger, OpenApi } from "@effect/platform";
```

### Node.js Specific

```typescript
import { NodeHttpServer } from "@effect/platform-node";

// Or use directly from platform:
import { HttpServer } from "@effect/platform";
```

## Architecture Overview

```
┌─────────────────────────────────────┐
│      HttpApi (Schema/Config)        │
│  ├─ HttpApiGroup[] (grouping)       │
│  └─ HttpApiEndpoint[] (per group)   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   HttpApiBuilder (Implementation)   │
│  ├─ group() → Layer[handlers]       │
│  ├─ handle() → add single handler   │
│  ├─ handleRaw() → raw request       │
│  └─ serve() → HttpServer.serve()    │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   HttpRouter (Route matching)       │
│  ├─ get/post/put/patch/del/head     │
│  ├─ mount/concat (composition)      │
│  └─ makeRoute() (create route)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│    HttpApp (Effect-based handler)   │
│  ├─ Default<E, R> (abstract app)    │
│  └─ DefaultServices (required)      │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   HttpServer (Platform-specific)    │
│  ├─ Node: http.createServer()       │
│  ├─ Bun: Bun.serve()                │
│  └─ serve() → Effect<void>          │
└─────────────────────────────────────┘
```

## 1. Defining an API

### Basic API Structure

```typescript
import { HttpApi, HttpApiGroup, HttpApiEndpoint, Schema } from "@effect/platform"

// Create the root API
class MyApi extends HttpApi.make("myApi") {}

// Define endpoint groups (like resource collections)
class BeansGroup extends HttpApiGroup.makeRoute("BeansGroup", MyApi) {}
class UsersGroup extends HttpApiGroup.makeRoute("UsersGroup", MyApi) {}

// Define individual endpoints within a group
class GetBean extends HttpApiEndpoint.make("GetBean")(
  "GET",
  "/beans/:id"
)(
  // Path parameters
  Schema.Struct({ id: Schema.String })
)(
  // Success response (status 200 by default)
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    remainingGrams: Schema.Number
  })
)

class CreateBean extends HttpApiEndpoint.make("CreateBean")(
  "POST",
  "/beans"
)(
  // Payload schema (request body, auto-detected from method)
  Schema.Struct({
    name: Schema.String,
    grams: Schema.Number
  })
)(
  // Success response (custom status 201)
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    grams: Schema.Number
  }).pipe(
    HttpApiSchema.annotations({ status: 201 })
  )
)

// Add endpoints to groups
class Beans extends BeansGroup.add(GetBean).add(CreateBean) {}
class Users extends UsersGroup.add(GetUser).add(ListUsers) {}

// Add groups to API
class Api extends MyApi.add(Beans).add(Users) {}
```

### Path Parameters

Path segments follow the format `/{literal}/:paramName`:

```typescript
const GetBean = HttpApiEndpoint.make("GetBean")(
	"GET",
	"/beans/:id", // `:id` becomes a path parameter
)(Schema.Struct({ id: Schema.String }))(BeanResponse);

// Path schema types:
// - Single param: Schema.Struct({ id: Schema.String })
// - Multiple params: Schema.Struct({ id: Schema.String, version: Schema.Number })
// - Via setPath(): endpoint.setPath(Schema.Struct({ ... }))
```

### Query Parameters (URL Search Params)

For GET/HEAD/DELETE methods without a body:

```typescript
const ListBeans = HttpApiEndpoint.make("ListBeans")("GET", "/beans")(
	// Query params (for GET methods, this becomes urlParams, not payload)
	Schema.Struct({
		skip: Schema.optional(Schema.Number),
		take: Schema.optional(Schema.Number),
		sortBy: Schema.optional(Schema.Literal("name", "grams")),
	}),
)(Schema.Array(BeanResponse));

// Or via setUrlParams():
endpoint.setUrlParams(
	Schema.Struct({
		skip: Schema.optional(Schema.Number),
		take: Schema.optional(Schema.Number),
	}),
);

// Normalization:
// Single value in array field becomes: { tags: ["tag1"] }
// Single value in non-array field becomes: { sortBy: "name" }
```

### Request Body (Payload)

For POST/PUT/PATCH:

```typescript
const CreateBean = HttpApiEndpoint.make("CreateBean")("POST", "/beans")(
	Schema.Struct({
		name: Schema.String,
		grams: Schema.Number,
	}),
)(BeanResponse);

// Or via setPayload():
endpoint.setPayload(
	Schema.Struct({
		name: Schema.String,
		grams: Schema.Number,
	}),
);
```

### Request Headers

```typescript
const GetBean = HttpApiEndpoint.make("GetBean")(
	"GET",
	"/beans/:id",
)(Schema.Struct({ id: Schema.String }))(BeanResponse).setHeaders(
	Schema.Struct({
		authorization: Schema.String,
		"x-custom-header": Schema.optional(Schema.String),
	}),
);
```

### Response Schemas (Multiple Status Codes)

```typescript
const UpdateBean = HttpApiEndpoint.make("UpdateBean")(
	"PUT",
	"/beans/:id",
)(
	Schema.Struct({
		id: Schema.String,
		name: Schema.String,
	}),
)(
	// Initial success (default 200)
	UpdatedBeanResponse,
)
	// Add another success response with different status
	.addSuccess(
		Schema.Struct({ message: Schema.Literal("updated") }),
		{ status: 202 }, // Accepted
	)
	// Add an error response
	.addError(Schema.Struct({ error: Schema.Literal("not_found") }), { status: 404 })
	.addError(Schema.Struct({ error: Schema.Literal("conflict") }), { status: 409 });
```

### Error Schemas (Global & Per-Endpoint)

```typescript
// Global API error
class Api extends MyApi
  .addError(
    Schema.Struct({ code: Schema.Literal("UNAUTHORIZED") })
      .pipe(HttpApiSchema.annotations({ status: 401 }))
  )
  .addError(
    Schema.Struct({ code: Schema.Literal("FORBIDDEN") })
      .pipe(HttpApiSchema.annotations({ status: 403 }))
  )

// Group-level error
class Beans extends BeansGroup
  .addError(
    Schema.Struct({ code: Schema.Literal("INVALID_BEAN") }),
    { status: 400 }
  )

// Endpoint-level error
class GetBean extends HttpApiEndpoint
  .addError(
    Schema.Struct({ code: Schema.Literal("BEAN_NOT_FOUND") }),
    { status: 404 }
  )
```

## 2. Implementing Handlers

### Basic Handler Pattern

```typescript
import { HttpApiBuilder, Layer, Effect } from "effect";

// Implement the API
const Api = HttpApiBuilder.group(MyApi, "Beans", (handlers) =>
	handlers
		.handle("GetBean", ({ path, request }) =>
			Effect.gen(function* () {
				const bean = yield* getBeanFromDb(path.id);
				return { id: bean.id, name: bean.name, remainingGrams: bean.remainingGrams };
			}),
		)
		.handle("CreateBean", ({ payload, request }) =>
			Effect.gen(function* () {
				const bean = yield* createBeanInDb(payload);
				return { id: bean.id, name: bean.name, grams: bean.grams };
			}),
		)
		.handle("UpdateBean", ({ path, payload }) =>
			Effect.gen(function* () {
				const updated = yield* updateBeanInDb(path.id, payload);
				return updated;
			}),
		)
		.handle("DeleteBean", ({ path }) =>
			Effect.gen(function* () {
				yield* deleteBeanFromDb(path.id);
				return HttpServerResponse.empty({ status: 204 });
			}),
		),
);

// Create a layer from the group implementation
const BeansLive = Api;
```

### Handler Signature

Handlers receive a request object with:

- `path`: Path parameters (if setPath)
- `urlParams`: URL search parameters (if setUrlParams)
- `payload`: Request body (if setPayload)
- `headers`: Request headers (if setHeaders)
- `request`: Raw HttpServerRequest

```typescript
type Handler = (request: {
	path?: PathType; // From setPath()
	urlParams?: UrlParamsType; // From setUrlParams()
	payload?: PayloadType; // From setPayload()
	headers?: HeadersType; // From setHeaders()
	request: HttpServerRequest;
}) => Effect<SuccessType | HttpServerResponse, ErrorType, R>;
```

### handleRaw() - Access Full Request/Response

For routes that need raw access (webhooks with raw body, better-auth's `/auth/*` catchall):

```typescript
.handleRaw("AuthHandler", ({ request }) =>
  Effect.gen(function* () {
    // Access raw request body as stream, buffer, text, etc.
    const rawBody = yield* request.arrayBuffer

    // Can return raw HttpServerResponse for full control
    return HttpServerResponse.raw({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true })
    })
  })
)

// Or for better-auth integration:
.handleRaw("BetterAuth", ({ request }) =>
  Effect.gen(function* () {
    // Forward to better-auth
    const response = yield* betterAuthHandler(request)
    return response // Raw response
  })
)
```

### Returning Different Responses

```typescript
.handle("GetUser", ({ path }) =>
  Effect.gen(function* () {
    const user = yield* getUserFromDb(path.id)

    if (!user) {
      // Option 1: Throw (gets caught and mapped to error schema)
      throw new Error("User not found")
    }

    if (someCondition) {
      // Option 2: Return HttpServerResponse for custom status/headers
      return HttpServerResponse.text("No Content", { status: 204 })
    }

    // Option 3: Return the typed response
    return {
      id: user.id,
      name: user.name,
      email: user.email
    }
  })
)
```

### Handling Multipart/Form Data (File Uploads)

```typescript
import { HttpApiSchema } from "@effect/platform";

const UploadFile = HttpApiEndpoint.make("UploadFile")(
	"POST",
	"/upload",
)(
	// Multipart schema
	HttpApiSchema.Multipart(
		Schema.Struct({
			title: Schema.String,
			file: HttpApiSchema.Multipart.file("application/pdf"),
		}),
	),
)(Schema.Struct({ url: Schema.String }))

	// Implementation:
	.handle("UploadFile", ({ payload }) =>
		Effect.gen(function* () {
			const { file, title } = payload;
			// file is a Part with { name, filename, contentType, content }
			const buffer = yield* Effect.orDie(file.content); // Stream -> Buffer
			const url = yield* saveFileToStorage(buffer, title);
			return { url };
		}),
	);

// For streaming multipart (large files):
const UploadLargeFile = HttpApiEndpoint.make("UploadLargeFile")(
	"POST",
	"/upload-stream",
)(
	HttpApiSchema.MultipartStream(
		Schema.Struct({
			title: Schema.String,
			file: HttpApiSchema.Multipart.file("*/*"),
		}),
	),
)(Schema.Struct({ url: Schema.String }))

	// Implementation gets Stream<Part>:
	.handleRaw("UploadLargeFile", ({ request, payload }) =>
		Effect.gen(function* () {
			// payload is Stream<Part>
			yield* Effect.forEach(payload, (part) =>
				Effect.gen(function* () {
					if (part.filename) {
						// Save file part to storage
						yield* saveFilePartToStorage(part);
					}
				}),
			);
			return { url: "..." };
		}),
	);
```

### Database & Service Integration

Handlers naturally integrate with Effect services:

```typescript
class DatabaseService extends Context.Tag("Database")<
  DatabaseService,
  { query: <A>(sql: string) => Effect.Effect<A> }
>() {}

.handle("GetBean", ({ path }) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const bean = yield* db.query(`SELECT * FROM beans WHERE id = $1`, [path.id])
    return bean
  })
)

// When serving, provide the service:
const BeansLive = Api.pipe(
  Layer.provide(DatabaseLive)
)
```

## 3. Middleware

### Global Middleware (API-wide)

```typescript
class AuthMiddleware extends HttpApiMiddleware.make("Auth")<
  { user: User; session: Session }
>(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const token = request.headers.authorization?.replace("Bearer ", "")

    if (!token) {
      throw new Error("Unauthorized")
    }

    const user = yield* verifyTokenAndGetUser(token)
    const session = yield* getSession(user.id)

    return { user, session }
  })
) {}

class Api extends MyApi.middleware(AuthMiddleware)
```

### Group-level Middleware

```typescript
class AdminGroup extends HttpApiGroup.makeRoute("Admin", MyApi)
  .middleware(AuthMiddleware)
  .middleware(AdminCheckMiddleware)
```

### Endpoint-level Middleware

```typescript
class AdminEndpoint extends HttpApiEndpoint.make("Admin")(
  "POST",
  "/admin"
)(
  Schema.Struct({ action: Schema.String })
)(
  Schema.Struct({ result: Schema.String })
)
.middleware(AuthMiddleware)
.middleware(AdminCheckMiddleware)
```

### Middleware with Errors

Middleware can define errors that propagate:

```typescript
class CustomError extends Schema.Class<CustomError>("CustomError")(
  { code: Schema.String, status: Schema.Number }
) {}

class Auth extends HttpApiMiddleware.make("Auth")<
  { user: User },
  CustomError
>(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const token = request.headers.authorization

    if (!token) {
      throw new CustomError({ code: "NO_TOKEN", status: 401 })
    }

    return { user: yield* getUser(token) }
  })
) {}

// Errors automatically added to endpoint's error schema
class Api extends MyApi.middleware(Auth)
```

### Security Middleware (Bearer Token, API Key, Basic Auth)

```typescript
import { HttpApiSecurity, HttpApiMiddleware } from "@effect/platform"

// Define security schemes
const BearerSecurity = HttpApiSecurity.bearer

const ApiKeySecurity = HttpApiSecurity.apiKey({ key: "X-API-Key" })

const BasicAuthSecurity = HttpApiSecurity.basic

// Implement security middleware
class BearerAuth extends HttpApiMiddleware.makeSecure("BearerAuth")({
  Bearer: (token: Redacted) =>
    Effect.gen(function* () {
      const user = yield* verifyBearerToken(Redacted.value(token))
      return { userId: user.id }
    })
}) {}

class ApiKeyAuth extends HttpApiMiddleware.makeSecure("ApiKeyAuth")({
  ApiKey: (key: Redacted) =>
    Effect.gen(function* () {
      const apiUser = yield* verifyApiKey(Redacted.value(key))
      return { apiUserId: apiUser.id }
    })
}) {}

// Add to endpoints
class ProtectedEndpoint extends HttpApiEndpoint
  .middleware(BearerAuth)
  .middleware(ApiKeyAuth)
```

### Optional Middleware

```typescript
class OptionalAuth extends HttpApiMiddleware.make("OptionalAuth")<
  { user?: User },
  never,
  { optional: true }
>(
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const token = request.headers.authorization?.replace("Bearer ", "")

    const user = token
      ? yield* verifyTokenAndGetUser(token)
      : undefined

    return { user }
  })
) {}

// Won't fail if auth is missing, but provides user if present
class Api extends MyApi.middleware(OptionalAuth)
```

## 4. Error Handling & Response Format

### Error Status Code Mapping

Errors automatically map to HTTP status codes via schema annotations:

```typescript
const NotFoundError = Schema.Struct({
	code: Schema.Literal("NOT_FOUND"),
	message: Schema.String,
}).pipe(HttpApiSchema.annotations({ status: 404 }));

const ValidationError = Schema.Struct({
	code: Schema.Literal("VALIDATION_ERROR"),
	fields: Schema.Array(
		Schema.Struct({
			path: Schema.Array(Schema.String),
			message: Schema.String,
		}),
	),
}).pipe(HttpApiSchema.annotations({ status: 400 }));

const endpoint = GetBean.addError(NotFoundError).addError(ValidationError);
```

### Throwing Errors in Handlers

```typescript
.handle("GetBean", ({ path }) =>
  Effect.gen(function* () {
    const bean = yield* getBeanFromDb(path.id)

    if (!bean) {
      // Throw (will be caught and encoded to error schema)
      throw new Error("NOT_FOUND")
    }

    return bean
  })
)

// Or: Effect.fail() for Effect-style error handling
.handle("GetBean", ({ path }) =>
  Effect.gen(function* () {
    const bean = yield* Effect.mapError(
      getBeanFromDb(path.id),
      (err): NotFoundError => ({
        code: "NOT_FOUND" as const,
        message: err.message
      })
    )

    return bean
  })
)
```

### Decoding Errors

If a request fails schema validation:

```typescript
// Default error from HttpApiDecodeError
{
  "success": false,
  "error": {
    "global": [
      {
        "message": "Expected number, got string",
        "path": ["urlParams", "id"]
      }
    ],
    "fields": []
  }
}
```

### Default HTTP Status Codes

| Situation                        | Status                    |
| -------------------------------- | ------------------------- |
| Success with void body           | 204 No Content            |
| Success with body                | 200 OK                    |
| Custom success (via `status: n`) | n                         |
| Unhandled error                  | 500 Internal Server Error |
| Schema decode error              | 400 Bad Request           |
| Route not found                  | 404 Not Found             |

## 5. Serving the API

### Complete Setup (Node.js)

```typescript
import { HttpApiBuilder, NodeHttpServer, Effect, Layer } from "effect";

// Define API (as above)
class MyApi extends HttpApi.make("api") {}

// Implement handlers
const ApiLive = HttpApiBuilder.group(MyApi, "main", (handlers) =>
	handlers.handle("GetItem", ({ path }) => Effect.succeed({ id: path.id })),
);

// Create server layer
const ServerLive = Layer.mergeAll(
	NodeHttpServer.layer(() => new http.Server(), { port: 3000 }),
	ApiLive,
	HttpApiBuilder.api(MyApi),
	HttpApiBuilder.serve(), // Creates HttpServer and serves the API
);

// Run
Effect.runPromise(Effect.scoped(Effect.void).pipe(Effect.provide(ServerLive)));
```

### With Middleware

```typescript
HttpApiBuilder.serve((app) =>
	app.pipe(
		// Add middleware
		HttpMiddleware.cors({
			allowedOrigins: ["https://example.com"],
			credentials: true,
		}),
		HttpMiddleware.logger,
		HttpMiddleware.xForwardedHeaders,
	),
);
```

### Mounting Sub-APIs

```typescript
// Define separate APIs
class UsersApi extends HttpApi.make("users") {}
class BeansApi extends HttpApi.make("beans") {}

// Implement separately
const UsersLive = HttpApiBuilder.group(UsersApi, "users", handlers => ...)
const BeansLive = HttpApiBuilder.group(BeansApi, "beans", handlers => ...)

// Compose at root
class RootApi extends HttpApi.make("root")
  .addHttpApi(UsersApi)
  .addHttpApi(BeansApi)
  .prefix("/api")

// All endpoints now have /api prefix
// /api/users/... and /api/beans/...
```

### Prefixing Routes

```typescript
class Api extends MyApi.prefix("/api")

// All endpoints now have /api prefix
// GET /api/beans/:id
// POST /api/beans
```

## 6. Raw Request Handling (for Webhooks & Catch-alls)

For routes that need access to raw request body (like better-auth's `/auth/*` handler or webhook verification):

```typescript
const AuthCatchall = HttpApiEndpoint.make("AuthCatchall")(
  "*",  // Any method
  "/auth/*"
)(
  void  // No schema
)(
  void  // No schema
)

.handleRaw("AuthCatchall", ({ request }) =>
  Effect.gen(function* () {
    // Access raw request
    const rawBody = yield* request.arrayBuffer
    const contentType = request.headers["content-type"]

    // Forward to better-auth or webhook handler
    const response = yield* betterAuthHandler(request)

    // Return raw response
    return response // HttpServerResponse
  })
)

// HttpServerResponse constructors:
HttpServerResponse.raw({
  status: 200,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ok: true })
})

HttpServerResponse.text("OK", { status: 200 })
HttpServerResponse.json({ ok: true }, { status: 200 })
HttpServerResponse.empty({ status: 204 })
HttpServerResponse.redirect("/", { status: 302 })
```

## 7. CORS Middleware

```typescript
import { HttpMiddleware } from "@effect/platform";

HttpApiBuilder.serve((app) =>
	app.pipe(
		HttpMiddleware.cors({
			allowedOrigins: [], // Empty = allow all (uses *)
			// OR
			// allowedOrigins: ["https://example.com", "https://app.example.com"],

			allowedMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],

			// Empty = reflect client's Access-Control-Request-Headers (allow all)
			// Non-empty = only allow specified headers
			allowedHeaders: [],

			exposedHeaders: ["X-Total-Count"],

			credentials: true,

			maxAge: 600, // 10 minutes
		}),
	),
);
```

**Important CORS Behavior:**

- If `allowedHeaders` is empty: **all headers** requested by client are allowed (permissive default)
- If `allowedHeaders` is non-empty: only specified headers are allowed (restrictive)

## 8. OpenTelemetry Integration

```typescript
import { HttpMiddleware } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { OpenTelemetry } from "@effect/opentelemetry";

const ServerLive = Layer.mergeAll(
	NodeHttpServer.layerConfig(() => new http.Server(), Config.literal({ port: 3000 })),

	// OpenTelemetry setup
	OpenTelemetry.tracer.layer,
	OpenTelemetry.metrics.layer,
	OpenTelemetry.meter.layer,

	ApiLive,
	HttpApiBuilder.serve((app) =>
		app.pipe(
			HttpMiddleware.logger, // Logs with trace context
			HttpMiddleware.withTracerDisabledForUrls(["/health", "/metrics"]),
		),
	),
);
```

## 9. Type-Safe Client Generation

The API schema generates a fully-typed client:

```typescript
import { HttpApiClient } from "@effect/platform";

const client = yield * HttpApiClient.make(MyApi);

// Fully typed!
const bean = yield * client.GetBean({ path: { id: "123" } });

// With headers
const user =
	yield *
	client.GetUser({
		path: { id: "user-1" },
		headers: { authorization: "Bearer token..." },
	});

// With query params
const beans =
	yield *
	client.ListBeans({
		urlParams: { skip: 0, take: 10, sortBy: "name" },
	});

// POST with body
const created =
	yield *
	client.CreateBean({
		payload: { name: "Espresso", grams: 20 },
	});
```

## 10. Package Versions & Compatibility

- **Latest (from repo)**: v0.95.0
- **Project (package.json)**: v4.0.0-beta.33 (Effect framework version, platform not listed)
- **Installation**: `npm install @effect/platform @effect/platform-node`

Note: @effect/platform versions typically follow @effect/core versions. Check npm/latest for current version matching Effect v4.0.0-beta.33+.

## 11. Complete Example

```typescript
import { HttpApi, HttpApiGroup, HttpApiEndpoint, HttpApiBuilder, HttpApiSchema, Schema, Layer, Effect } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import http from "http"

// 1. Define API
class MyApi extends HttpApi.make("api") {}

// 2. Define endpoints
const GetBean = HttpApiEndpoint.make("GetBean")(
  "GET",
  "/beans/:id"
)(
  Schema.Struct({ id: Schema.String })
)(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    grams: Schema.Number
  })
)
.addError(
  Schema.Struct({ error: Schema.Literal("NOT_FOUND") }),
  { status: 404 }
)

const CreateBean = HttpApiEndpoint.make("CreateBean")(
  "POST",
  "/beans"
)(
  Schema.Struct({ name: Schema.String, grams: Schema.Number })
)(
  Schema.Struct({ id: Schema.String, name: Schema.String, grams: Schema.Number })
)

// 3. Create group
class Beans extends HttpApiGroup.makeRoute("Beans", MyApi)
  .add(GetBean)
  .add(CreateBean)

// 4. Add to API
class Api extends MyApi.add(Beans)

// 5. Implement handlers
const ApiBeans = HttpApiBuilder.group(Api, "Beans", (handlers) =>
  handlers
    .handle("GetBean", ({ path }) =>
      Effect.gen(function* () {
        // Access database, validate, etc.
        const bean = yield* getBeanFromDb(path.id)
        if (!bean) throw new Error("NOT_FOUND")
        return bean
      })
    )
    .handle("CreateBean", ({ payload }) =>
      Effect.gen(function* () {
        return yield* createBeanInDb(payload)
      })
    )
)

// 6. Serve
const main = Effect.gen(function* () {
  yield* Effect.scoped(
    HttpApiBuilder.serve((app) =>
      app.pipe(
        HttpMiddleware.cors(),
        HttpMiddleware.logger
      )
    )
  )
})

const ServerLive = Layer.mergeAll(
  NodeHttpServer.layer(() => new http.Server(), { port: 3000 }),
  ApiBeans,
  HttpApiBuilder.api(Api)
)

Effect.runPromise(Effect.provide(main, ServerLive))
```

## Key Differences from Hono

| Aspect                   | @effect/platform                   | Hono                     |
| ------------------------ | ---------------------------------- | ------------------------ |
| **Philosophy**           | Declare schema first               | Direct routing           |
| **Type Safety**          | Full end-to-end (schema → handler) | Via TypeScript + JSDoc   |
| **Error Handling**       | Schema-based, status code inferred | Manual status code       |
| **Documentation**        | Auto-generate OpenAPI              | Manual or via plugins    |
| **Middleware**           | Composable, typed                  | Via middleware functions |
| **Dependency Injection** | Built-in (Effect Context)          | Via c.get/c.set          |
| **Test Client**          | Type-safe `HttpApiClient`          | Via fetch/axios + types  |
| **Learning Curve**       | Higher (Effect + schemas)          | Lower                    |

## Limitations & Gotchas

1. **No flat "catch-all" routes**: Use `handleRaw()` for catch-all paths like `/auth/*`
2. **Router composition**: Mounting sub-routers uses `prefix()`, not separate HttpRouter instances
3. **Module-level routing**: Routes defined at definition time; dynamic routes require wrapper Effect
4. **Streaming responses**: Limited; use `handleRaw()` + `HttpServerResponse.stream()`
5. **CORS complexity**: Default permissive; restrictive configs need careful header specification
6. **Error union complexity**: Errors at API/Group/Endpoint level create union; keep simple

## Resources

- **Repo**: `/home/cschmatzler/.local/share/opensrc/repos/github.com/effect-ts/effect`
- **Package**: `packages/platform/`
- **Tests**: `packages/platform/test/HttpApiBuilder.test.ts`
- **Node adapter**: `packages/platform-node/`
- **API docs**: Generated from JSDoc in source files
