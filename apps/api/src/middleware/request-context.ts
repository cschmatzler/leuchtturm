import { Context, Effect, Option } from "effect";
import {
	Headers,
	HttpMiddleware,
	HttpServerError,
	HttpServerRequest,
	HttpServerResponse,
} from "effect/unstable/http";

export namespace RequestContext {
	const RequestIdHeader = "x-request-id";
	const RequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
	const TrustedProxyPeers = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

	export interface CurrentShape {
		readonly method: string;
		readonly path: string;
		readonly requestId: string;
	}

	export class Current extends Context.Service<Current, CurrentShape>()(
		"@leuchtturm/RequestContext",
	) {}

	const requestPath = (url: string) => {
		try {
			return new URL(url).pathname;
		} catch {
			return new URL(url, "http://internal").pathname;
		}
	};

	const getIncomingRequestId = (
		request: HttpServerRequest.HttpServerRequest,
	): string | undefined => {
		const peerAddress = Option.getOrElse(request.remoteAddress, () => "unknown");
		if (peerAddress !== "unknown" && !TrustedProxyPeers.has(peerAddress)) {
			return undefined;
		}

		return Headers.get(request.headers, RequestIdHeader).pipe(
			Option.map((value) => value.trim()),
			Option.filter((value) => RequestIdPattern.test(value)),
			Option.getOrUndefined,
		);
	};

	export const makeRequestId = (input?: string): string => {
		if (input && RequestIdPattern.test(input)) {
			return input;
		}

		return crypto.randomUUID();
	};

	export const Middleware = HttpMiddleware.make((app) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const requestId = makeRequestId(getIncomingRequestId(request));
			const current = Current.of({
				method: request.method,
				path: requestPath(request.url),
				requestId,
			});
			const appWithContext = app.pipe(
				Effect.annotateLogs({ requestId }),
				Effect.annotateSpans({ "http.request.id": requestId }),
				Effect.provideService(Current, current),
			);

			yield* Effect.annotateCurrentSpan({ "http.request.id": requestId });
			const exit = yield* Effect.exit(appWithContext);

			if (exit._tag === "Success") {
				return HttpServerResponse.setHeader(exit.value, RequestIdHeader, requestId);
			}

			const [response] = yield* HttpServerError.causeResponse(exit.cause);
			return HttpServerResponse.setHeader(response, RequestIdHeader, requestId);
		}),
	);
}
