import {
	ActiveFilters,
	ActiveFiltersMobileContainer,
} from "@chevrotain/web/components/data-table-filter/active-filters";
import { DataTableFilterProvider } from "@chevrotain/web/components/data-table-filter/context";
import { FilterActions } from "@chevrotain/web/components/data-table-filter/filter-actions";
import { FilterSelector } from "@chevrotain/web/components/data-table-filter/filter-selector";
import type {
	Column,
	DataTableFilterActions,
	FiltersState,
} from "@chevrotain/web/components/data-table-filter/types";
import { useIsMobile } from "@chevrotain/web/hooks/use-mobile";

export interface DataTableFilterProps<TData> {
	filterColumns: Column<TData>[];
	filters: FiltersState;
	actions: DataTableFilterActions;
}

export function DataTableFilter<TData>({
	filterColumns,
	filters,
	actions,
}: DataTableFilterProps<TData>) {
	const isMobile = useIsMobile();

	const content = isMobile ? (
		<div className="flex w-full items-start justify-between gap-2">
			<div className="flex gap-1">
				<FilterSelector />
				<FilterActions />
			</div>
			<ActiveFiltersMobileContainer>
				<ActiveFilters />
			</ActiveFiltersMobileContainer>
		</div>
	) : (
		<div className="flex w-full items-start justify-between gap-2">
			<div className="flex w-full flex-1 gap-2 md:flex-wrap">
				<FilterSelector />
				<ActiveFilters />
			</div>
			<FilterActions />
		</div>
	);

	return (
		<DataTableFilterProvider filterColumns={filterColumns} filters={filters} actions={actions}>
			{content}
		</DataTableFilterProvider>
	);
}
