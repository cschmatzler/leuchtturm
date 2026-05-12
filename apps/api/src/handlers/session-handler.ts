import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { LeuchtturmApi } from "@leuchtturm/api/contract";
import { Metrics } from "@leuchtturm/api/observability/metrics";
import { Auth } from "@leuchtturm/core/auth";

export namespace SessionHandler {
	const deviceSessions = Effect.fn("session.deviceSessions")(function* () {
		const auth = yield* Auth.Service;
		const request = yield* HttpServerRequest.HttpServerRequest;

		return yield* auth.getDeviceSessions(new Headers(request.headers as Record<string, string>));
	});

	export const layer = HttpApiBuilder.group(LeuchtturmApi, "session", (handlers) =>
		handlers.handle("deviceSessions", () =>
			deviceSessions().pipe(
				Effect.tap(() => Metrics.action("session.device_sessions", "success")),
				Effect.catchCause((cause) =>
					Metrics.action("session.device_sessions", "failure").pipe(
						Effect.andThen(Effect.failCause(cause)),
					),
				),
			),
		),
	);
}
