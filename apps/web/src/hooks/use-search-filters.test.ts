import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { FiltersState } from "@one/web/components/data-table-filter/types";
import { useSearchFilters } from "@one/web/hooks/use-search-filters";

type NavigateOptions = Parameters<
	ReturnType<Parameters<typeof useSearchFilters>[0]["route"]["useNavigate"]>
>[0];

let mockSearchState: Record<string, unknown> = {};
const mockNavigate = vi.fn((_opts: NavigateOptions) => {});

function createMockRoute(search: Record<string, unknown> = {}) {
	mockSearchState = search;
	return {
		useSearch: () => mockSearchState,
		useNavigate: () => mockNavigate,
	} satisfies Parameters<typeof useSearchFilters>[0]["route"];
}

function getSearchResult(prevSearch: Record<string, unknown>): Record<string, unknown> {
	const call = mockNavigate.mock.calls[0][0];
	return call.search(prevSearch);
}

describe("useSearchFilters", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
		mockSearchState = {};
	});

	it("accepts a function updater", () => {
		const initialFilters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		];
		const route = createMockRoute({ filters: initialFilters });
		const { result } = renderHook(() => useSearchFilters({ route }));

		act(() => {
			result.current[1]((prev: FiltersState) => [
				...prev,
				{ columnId: "status", type: "option", operator: "is", values: ["active"] },
			]);
		});

		expect(mockNavigate).toHaveBeenCalled();
		expect(getSearchResult({ filters: initialFilters })).toEqual({
			filters: [
				{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
				{ columnId: "status", type: "option", operator: "is", values: ["active"] },
			],
		});
	});

	it("preserves other search params", () => {
		const initialSearch = { page: 1, sort: "name" };
		const route = createMockRoute(initialSearch);
		const { result } = renderHook(() => useSearchFilters({ route }));

		const newFilters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["Jane"] },
		];

		act(() => {
			result.current[1](newFilters);
		});

		expect(mockNavigate).toHaveBeenCalled();
		expect(getSearchResult(initialSearch)).toEqual({
			page: 1,
			sort: "name",
			filters: newFilters,
		});
	});

	it("does not navigate when filters are unchanged (same reference)", () => {
		const initialFilters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		];
		const route = createMockRoute({ filters: initialFilters });
		const { result } = renderHook(() => useSearchFilters({ route }));

		act(() => {
			result.current[1](() => initialFilters);
		});

		// navigate is still called, but the search function returns the same object
		expect(mockNavigate).toHaveBeenCalled();
		const searchResult = getSearchResult({ filters: initialFilters });
		expect(searchResult).toEqual({ filters: initialFilters });
	});

	it("navigates when updater returns new array with same values (different reference)", () => {
		const initialFilters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["John"] },
		];
		const route = createMockRoute({ filters: initialFilters });
		const { result } = renderHook(() => useSearchFilters({ route }));

		act(() => {
			result.current[1](() => [...initialFilters]);
		});

		expect(mockNavigate).toHaveBeenCalled();
	});

	it("uses custom key for search params", () => {
		const initialFilters: FiltersState = [
			{ columnId: "name", type: "text", operator: "contains", values: ["Jane"] },
		];
		const route = createMockRoute({ myFilters: initialFilters });
		const { result } = renderHook(() => useSearchFilters({ route, key: "myFilters" }));

		expect(result.current[0]).toEqual(initialFilters);

		const newFilters: FiltersState = [
			{ columnId: "status", type: "option", operator: "is", values: ["active"] },
		];

		act(() => {
			result.current[1](newFilters);
		});

		expect(mockNavigate).toHaveBeenCalled();
		expect(getSearchResult({ myFilters: initialFilters })).toEqual({
			myFilters: newFilters,
		});
	});

	it("falls back to defaultValue when search param is missing", () => {
		const defaultFilters: FiltersState = [
			{ columnId: "status", type: "option", operator: "is", values: ["active"] },
		];
		const route = createMockRoute({});
		const { result } = renderHook(() => useSearchFilters({ route, defaultValue: defaultFilters }));

		expect(result.current[0]).toEqual(defaultFilters);
	});
});
