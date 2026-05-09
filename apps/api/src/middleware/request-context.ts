import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export namespace RequestContext {
	const RequestId = Schema.String.check(Schema.isUUID(4));

	export interface RequestContextShape {
		readonly method: string;
		readonly path: string;
		readonly requestId: string;
		readonly waitUntil: ExecutionContext["waitUntil"];
	}

	export class Service extends Context.Service<Service, RequestContextShape>()(
		"@leuchtturm/api/RequestContext",
	) {}

	export const make = (request: Request, executionContext: Pick<ExecutionContext, "waitUntil">) => {
		const requestId = Option.fromNullishOr(request.headers.get("x-request-id")).pipe(
			Option.map((value) => value.trim()),
			Option.flatMap(Schema.decodeUnknownOption(RequestId)),
			Option.getOrElse(() => crypto.randomUUID()),
		);

		return Service.of({
			method: request.method,
			path: request.url,
			requestId,
			waitUntil: executionContext.waitUntil.bind(executionContext),
		});
	};

	export const makeContext = (
		request: Request,
		executionContext: Pick<ExecutionContext, "waitUntil">,
	) => Context.add(Context.empty(), Service, make(request, executionContext));

	const run = Effect.fn("RequestContext.run")(function* <E, R>(
		app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
	) {
		const context = yield* Service;

		return yield* app.pipe(
			Effect.annotateLogs({ requestId: context.requestId }),
			Effect.annotateSpans({ "http.request.id": context.requestId }),
			Effect.provideService(Service, context),
			Effect.map((response) =>
				HttpServerResponse.setHeader(response, "x-request-id", context.requestId),
			),
			Effect.catchCause((cause) =>
				HttpServerError.causeResponse(cause).pipe(
					Effect.map(([response]) =>
						HttpServerResponse.setHeader(response, "x-request-id", context.requestId),
					),
				),
			),
		);
	});

	export const middleware = HttpMiddleware.make(run);
}
