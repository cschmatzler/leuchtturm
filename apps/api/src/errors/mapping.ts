import type { ContentfulStatusCode } from "hono/utils/http-status";

import type {
	BillingError,
	ClickHouseError,
	DatabaseError,
	EmailError,
	ForbiddenError,
	NotFoundError,
	RateLimitError,
	UnauthorizedError,
	ValidationError,
} from "@chevrotain/core/errors";

type TaggedApiError =
	| NotFoundError
	| UnauthorizedError
	| ForbiddenError
	| ValidationError
	| RateLimitError
	| DatabaseError
	| ClickHouseError
	| EmailError
	| BillingError;

/** Compile-time exhaustive: adding a new TaggedApiError without a status entry is a type error. */
const STATUS_MAP = {
	NotFoundError: 404,
	UnauthorizedError: 401,
	ForbiddenError: 403,
	ValidationError: 400,
	RateLimitError: 429,
	DatabaseError: 500,
	ClickHouseError: 500,
	EmailError: 500,
	BillingError: 500,
} as const satisfies Record<TaggedApiError["_tag"], ContentfulStatusCode>;

export function isTaggedError(error: unknown): error is TaggedApiError {
	return (
		typeof error === "object" &&
		error !== null &&
		"_tag" in error &&
		typeof (error as { _tag: unknown })._tag === "string" &&
		(error as { _tag: string })._tag in STATUS_MAP
	);
}

export function taggedErrorToStatus(error: TaggedApiError): ContentfulStatusCode {
	return STATUS_MAP[error._tag] ?? 500;
}

export function taggedErrorToResponse(error: TaggedApiError) {
	switch (error._tag) {
		case "ValidationError":
			return {
				global: error.global ?? [],
				fields: error.fields ?? [],
			};
		case "NotFoundError":
			return {
				global: [{ code: "not_found", message: error.message ?? "Not found" }],
				fields: [],
			};
		case "UnauthorizedError":
			return {
				global: [{ code: "unauthorized", message: error.message ?? "Unauthorized" }],
				fields: [],
			};
		case "ForbiddenError":
			return {
				global: [{ code: "forbidden", message: error.message ?? "Forbidden" }],
				fields: [],
			};
		case "RateLimitError":
			return {
				global: [{ code: "rate_limit", message: error.message ?? "Too many requests" }],
				fields: [],
			};
		default:
			// Infrastructure errors — don't leak internals
			return {
				global: [{ code: "internal", message: "Internal server error" }],
				fields: [],
			};
	}
}
