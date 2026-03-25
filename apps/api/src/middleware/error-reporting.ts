import { Cause, Effect, Exit } from "effect";
import { HttpMiddleware, HttpServerRequest } from "effect/unstable/http";

import { reportApiError } from "@chevrotain/api/analytics/report-error";
import { statusFromCause } from "@chevrotain/api/metrics";
import { Analytics } from "@chevrotain/core/analytics/index";

export const ApiErrorReportingMiddleware = HttpMiddleware.make((app) =>
	Effect.gen(function* () {
		const request = yield* HttpServerRequest.HttpServerRequest;
		const exit = yield* Effect.exit(app);

		if (Exit.isSuccess(exit)) {
			return exit.value;
		}

		const status = statusFromCause(exit.cause);
		if (status >= 500) {
			const analytics = yield* Analytics.Service;
			const firstFailure = exit.cause.reasons.find(Cause.isFailReason);
			yield* reportApiError(analytics, {
				request,
				statusCode: status,
				error: firstFailure?.error,
				fallbackMessage: Cause.pretty(exit.cause),
			});
		}

		return yield* Effect.failCause(exit.cause);
	}),
);
