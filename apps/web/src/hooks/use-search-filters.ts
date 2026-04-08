import { functionalUpdate } from "@tanstack/react-router";
import { useCallback, type SetStateAction } from "react";

import type { FiltersState } from "@leuchtturm/web/components/data-table-filter/types";

type SearchRoute = {
	useSearch: () => Record<string, unknown>;
	useNavigate: () => (options: {
		search: (prev: Record<string, unknown>) => Record<string, unknown>;
	}) => void;
};

export function useSearchFilters<TRoute extends SearchRoute, TKey extends string = "filters">({
	route,
	key = "filters" as TKey,
	defaultValue = [],
}: {
	route: TRoute;
	key?: TKey;
	defaultValue?: FiltersState;
}) {
	const search = route.useSearch();
	const navigate = route.useNavigate();
	const filters = (search[key as keyof typeof search] ?? defaultValue) as FiltersState;

	const setFilters = useCallback(
		(update: SetStateAction<FiltersState>) => {
			navigate({
				search: (prev) => {
					const previousFilters = (prev[key] ?? defaultValue) as FiltersState;
					const nextFilters = functionalUpdate(update, previousFilters);
					if (nextFilters === previousFilters) return prev;
					return { ...prev, [key]: nextFilters };
				},
			});
		},
		[defaultValue, key, navigate],
	);

	return [filters, setFilters] as const;
}
