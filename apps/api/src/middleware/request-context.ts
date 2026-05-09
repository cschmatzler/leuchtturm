import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export namespace RequestContext {
	const RequestIdHeader = "x-request-id";
	const RequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
	export interface RequestContextShape {
		readonly method: string;
		readonly path: string;
		readonly requestId: string;
	}

	export class Service extends Context.Service<Service, RequestContextShape>()(
		"@leuchtturm/RequestContext",
	) {}

	const requestId = Effect.fn("RequestContext.requestId")(function* (
		request: HttpServerRequest.HttpServerRequest,
	) {
		return yield* Effect.succeed(
			Headers.get(request.headers, RequestIdHeader).pipe(
				Option.map((value) => value.trim()),
				Option.filter((value) => RequestIdPattern.test(value)),
				Option.getOrElse(() => crypto.randomUUID()),
			),
		);
	});

	export const Middleware = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const id = yield* requestId(request);
			const context = Service.of({
				method: request.method,
				path: request.url,
				requestId: id,
			});

			yield* Effect.annotateCurrentSpan({ "http.request.id": id });

			return yield* app.pipe(
				Effect.annotateLogs({ requestId: id }),
				Effect.annotateSpans({ "http.request.id": id }),
				Effect.provideService(Service, context),
				Effect.map((response) => HttpServerResponse.setHeader(response, RequestIdHeader, id)),
				Effect.catchCause((cause) =>
					HttpServerError.causeResponse(cause).pipe(
						Effect.map(([response]) => HttpServerResponse.setHeader(response, RequestIdHeader, id)),
					),
				),
			);
		}),
	);
}
