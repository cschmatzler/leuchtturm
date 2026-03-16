import { describe, expect, it } from "vite-plus/test";

import { PublicError } from "@roasted/core/result";

describe("PublicError", () => {
	it("creates an error with default empty arrays", () => {
		const error = new PublicError({});

		expect(error).toBeInstanceOf(Error);
		expect(error.status).toBeUndefined();
		expect(error.global).toEqual([]);
		expect(error.fields).toEqual([]);
	});

	it("creates an error with a status code", () => {
		const error = new PublicError({ status: 400 });

		expect(error.status).toBe(400);
	});

	it("creates an error with global errors", () => {
		const globalErrors = [
			{ message: "Something went wrong" },
			{ code: "AUTH_FAILED", message: "Authentication failed" },
		];
		const error = new PublicError({ global: globalErrors });

		expect(error.global).toEqual(globalErrors);
	});

	it("creates an error with field errors", () => {
		const fieldErrors = [
			{ message: "Email is required", path: ["email"] },
			{ code: "INVALID_FORMAT", message: "Invalid date format", path: ["profile", "dateOfBirth"] },
		];
		const error = new PublicError({ fields: fieldErrors });

		expect(error.fields).toEqual(fieldErrors);
	});

	it("supports numeric path segments for array indices", () => {
		const error = new PublicError({
			fields: [{ message: "Invalid item", path: ["items", 0, "name"] }],
		});

		expect(error.fields[0].path).toEqual(["items", 0, "name"]);
	});
});
