import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Headers from "effect/unstable/http/Headers";
import * as HttpMiddleware from "effect/unstable/http/HttpMiddleware";
import * as HttpServerError from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export namespace RequestContext {
	const RequestId = Schema.String.check(Schema.isUUID(4));

	export interface RequestContextShape {
		readonly method: string;
		readonly path: string;
		readonly requestId: string;
	}

	export class Service extends Context.Service<Service, RequestContextShape>()(
		"@leuchtturm/RequestContext",
	) {}

	export const Middleware = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const id = Headers.get(request.headers, "x-request-id").pipe(
				Option.map((value) => value.trim()),
				Option.flatMap(Schema.decodeUnknownOption(RequestId)),
				Option.getOrElse(() => crypto.randomUUID()),
			);

			const context = Service.of({
				method: request.method,
				path: request.url,
				requestId: id,
			});

			return yield* app.pipe(
				Effect.annotateLogs({ requestId: id }),
				Effect.annotateSpans({ "http.request.id": id }),
				Effect.provideService(Service, context),
				Effect.map((response) => HttpServerResponse.setHeader(response, "x-request-id", id)),
				Effect.catchCause((cause) =>
					HttpServerError.causeResponse(cause).pipe(
						Effect.map(([response]) => HttpServerResponse.setHeader(response, "x-request-id", id)),
					),
				),
			);
		}),
	);
}
