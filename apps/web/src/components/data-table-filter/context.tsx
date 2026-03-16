import { createContext, useContext, type ReactNode } from "react";

import type {
	Column,
	DataTableFilterActions,
	FiltersState,
} from "@one/web/components/data-table-filter/types";

type DataTableFilterContextValue = {
	filterColumns: Column<unknown>[];
	filters: FiltersState;
	actions: DataTableFilterActions;
};

const DataTableFilterContext = createContext<DataTableFilterContextValue | null>(null);

export function DataTableFilterProvider<TData>({
	children,
	filterColumns,
	filters,
	actions,
}: {
	children: ReactNode;
	filterColumns: Column<TData>[];
	filters: FiltersState;
	actions: DataTableFilterActions;
}) {
	return (
		<DataTableFilterContext.Provider
			value={{
				filterColumns: filterColumns as Column<unknown>[],
				filters,
				actions,
			}}
		>
			{children}
		</DataTableFilterContext.Provider>
	);
}

export function useDataTableFilterContext<TData>() {
	const context = useContext(DataTableFilterContext);

	if (!context) {
		throw new Error("useDataTableFilterContext must be used within <DataTableFilter />");
	}

	return {
		...context,
		filterColumns: context.filterColumns as Column<TData>[],
	};
}
