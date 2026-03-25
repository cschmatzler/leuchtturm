import { Effect, Option, ServiceMap } from "effect";
import {
	Headers,
	HttpMiddleware,
	HttpServerError,
	HttpServerRequest,
	HttpServerResponse,
} from "effect/unstable/http";

import { routeLabelFromUrl } from "@chevrotain/api/metrics";

const REQUEST_ID_HEADER = "x-request-id";
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const TRUSTED_PROXY_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export interface RequestContextShape {
	readonly requestId: string;
	readonly route: string;
}

export class RequestContext extends ServiceMap.Service<RequestContext, RequestContextShape>()(
	"RequestContext",
) {}

function getIncomingRequestId(request: HttpServerRequest.HttpServerRequest): string | undefined {
	const peerAddress = Option.getOrElse(request.remoteAddress, () => "unknown");
	if (!TRUSTED_PROXY_PEERS.has(peerAddress)) {
		return undefined;
	}

	return Headers.get(request.headers, REQUEST_ID_HEADER).pipe(
		Option.map((value) => value.trim()),
		Option.filter((value) => REQUEST_ID_PATTERN.test(value)),
		Option.getOrUndefined,
	);
}

export function makeRequestId(input?: string): string {
	if (input && REQUEST_ID_PATTERN.test(input)) {
		return input;
	}

	return crypto.randomUUID();
}

export const RequestContextMiddleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const requestId = makeRequestId(getIncomingRequestId(request));
		const route = routeLabelFromUrl(request.url);

		yield* Effect.annotateCurrentSpan({
			"http.route": route,
			"http.request_id": requestId,
		});

		const exit = yield* Effect.exit(
			Effect.provideService(
				Effect.annotateLogs(Effect.annotateLogs(app, "requestId", requestId), "route", route),
				RequestContext,
				{ requestId, route },
			),
		);

		if (exit._tag === "Success") {
			return HttpServerResponse.setHeader(exit.value, REQUEST_ID_HEADER, requestId);
		}

		const [response] = yield* HttpServerError.causeResponse(exit.cause);
		return HttpServerResponse.setHeader(response, REQUEST_ID_HEADER, requestId);
	}),
);
