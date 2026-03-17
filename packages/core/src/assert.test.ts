import { describe, expect, it } from "vite-plus/test";

import { assert } from "@chevrotain/core/assert";
import { NotFoundError } from "@chevrotain/core/errors";

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

	it("throws a NotFoundError for null", () => {
		expect(() => assert(null)).toThrow(NotFoundError);
		try {
			assert(null);
		} catch (error) {
			expect(error).toBeInstanceOf(NotFoundError);
			expect((error as NotFoundError).message).toBe("Not found");
		}
	});

	it("throws a NotFoundError for undefined", () => {
		expect(() => assert(undefined)).toThrow(NotFoundError);
		try {
			assert(undefined);
		} catch (error) {
			expect(error).toBeInstanceOf(NotFoundError);
			expect((error as NotFoundError).message).toBe("Not found");
		}
	});

	it("narrows the type from T | null | undefined to T", () => {
		const value: string | null | undefined = "test";
		assert(value);
		const result: string = value;
		expect(result).toBe("test");
	});
});
