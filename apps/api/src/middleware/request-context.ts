import { Effect, Option } from "effect";
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
			const exit = yield* Effect.exit(app);

			if (exit._tag === "Success") {
				return HttpServerResponse.setHeader(exit.value, RequestIdHeader, requestId);
			}

			const [response] = yield* HttpServerError.causeResponse(exit.cause);
			return HttpServerResponse.setHeader(response, RequestIdHeader, requestId);
		}),
	);
}
