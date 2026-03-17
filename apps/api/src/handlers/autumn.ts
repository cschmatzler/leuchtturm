import { autumnHandler } from "autumn-js/backend";
import { Effect } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { ChevrotainApi } from "@chevrotain/api/contract";
import { CurrentUser } from "@chevrotain/api/middleware/auth";

/** Passthrough handler that forwards requests to autumn-js billing SDK. */
const passthrough = () =>
	Effect.gen(function* () {
		const { user } = yield* CurrentUser;
		const request = yield* HttpServerRequest.HttpServerRequest;
		const rawRequest = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie);

		const body = request.method !== "GET" ? yield* Effect.promise(() => rawRequest.json()) : null;

		const { statusCode, response } = yield* Effect.promise(() =>
			autumnHandler({
				customerId: user.id,
				customerData: {
					name: user.name,
					email: user.email,
				},
				request: {
					url: rawRequest.url,
					method: rawRequest.method,
					body,
				},
			}),
		);

		return HttpServerResponse.jsonUnsafe(response, { status: statusCode });
	});

export const AutumnHandlerLive = HttpApiBuilder.group(ChevrotainApi, "autumn", (handlers) =>
	handlers.handleRaw("autumnGet", passthrough).handleRaw("autumnPost", passthrough),
);
