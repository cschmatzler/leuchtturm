import { type } from "arktype";

const GlobalError = type({
	"code?": "string",
	message: "string",
});
type GlobalError = typeof GlobalError.infer;

const FieldError = type({
	"code?": "string",
	message: "string",
	path: "(string | number)[]",
});
type FieldError = typeof FieldError.infer;

export interface PublicErrorOptions {
	status?: number;
	global?: GlobalError[];
	fields?: FieldError[];
}

export class PublicError extends Error {
	status?: number;
	global: GlobalError[];
	fields: FieldError[];

	constructor(options: PublicErrorOptions) {
		super();
		this.status = options?.status;
		this.global = options?.global || [];
		this.fields = options?.fields || [];
	}
}

export const Failure = type({
	success: "false",
	error: {
		global: GlobalError.array(),
		fields: FieldError.array(),
	},
});
export type Failure = typeof Failure.infer;
