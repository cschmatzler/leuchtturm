import { describe, expect, it } from "vite-plus/test";

import { assert } from "@chevrotain/core/assert";
import { PublicError } from "@chevrotain/core/result";

describe("assert", () => {
	it("does not throw for a truthy value", () => {
		expect(() => assert("hello")).not.toThrow();
	});

	it("does not throw for zero", () => {
		expect(() => assert(0)).not.toThrow();
	});

	it("does not throw for false", () => {
		expect(() => assert(false)).not.toThrow();
	});

	it("does not throw for an empty string", () => {
		expect(() => assert("")).not.toThrow();
	});

	it("throws a PublicError with status 404 for null", () => {
		expect(() => assert(null)).toThrow(PublicError);
		try {
			assert(null);
		} catch (error) {
			expect(error).toBeInstanceOf(PublicError);
			expect((error as PublicError).status).toBe(404);
			expect((error as PublicError).global).toEqual([{ message: "Not found" }]);
		}
	});

	it("throws a PublicError with status 404 for undefined", () => {
		expect(() => assert(undefined)).toThrow(PublicError);
		try {
			assert(undefined);
		} catch (error) {
			expect(error).toBeInstanceOf(PublicError);
			expect((error as PublicError).status).toBe(404);
			expect((error as PublicError).global).toEqual([{ message: "Not found" }]);
		}
	});

	it("narrows the type from T | null | undefined to T", () => {
		const value: string | null | undefined = "test";
		assert(value);
		const result: string = value;
		expect(result).toBe("test");
	});
});
