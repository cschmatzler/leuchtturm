import { Data } from "effect";

// --- HTTP-mappable errors ---

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
	readonly resource?: string;
	readonly message?: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
	readonly message?: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
	readonly message?: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
	readonly fields?: ReadonlyArray<{
		readonly path: ReadonlyArray<string | number>;
		readonly message: string;
		readonly code?: string;
	}>;
	readonly global?: ReadonlyArray<{
		readonly message: string;
		readonly code?: string;
	}>;
}> {}

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
	readonly message?: string;
}> {}

// --- Infrastructure errors ---

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}

export class ClickHouseError extends Data.TaggedError("ClickHouseError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}

export class EmailError extends Data.TaggedError("EmailError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}

export class BillingError extends Data.TaggedError("BillingError")<{
	readonly message: string;
	readonly cause: unknown;
}> {}
