import { XIcon } from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";

import { useDataTableFilterContext } from "@leuchtturm/web/components/data-table-filter/context";
import { FilterOperator } from "@leuchtturm/web/components/data-table-filter/filter-operator";
import { FilterSubject } from "@leuchtturm/web/components/data-table-filter/filter-subject";
import { FilterValue } from "@leuchtturm/web/components/data-table-filter/filter-value";
import { getColumn } from "@leuchtturm/web/components/data-table-filter/helpers";
import type {
	Column,
	ColumnDataType,
	FilterModel,
} from "@leuchtturm/web/components/data-table-filter/types";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Separator } from "@leuchtturm/web/components/ui/separator";

export function ActiveFilters<TData>() {
	const { filterColumns, filters } = useDataTableFilterContext<TData>();

	return (
		<>
			{filters.map((filter) => {
				const id = filter.columnId;

				const column = getColumn(filterColumns, id);

				if (!filter.values) return null;

				return (
					<ActiveFilter key={`active-filter-${filter.columnId}`} filter={filter} column={column} />
				);
			})}
		</>
	);
}

interface ActiveFilterProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
}

const ActiveFilter = memo(ActiveFilterComponent) as typeof ActiveFilterComponent;

function ActiveFilterComponent<TData, TType extends ColumnDataType>({
	filter,
	column,
}: ActiveFilterProps<TData, TType>) {
	const { actions } = useDataTableFilterContext();

	return (
		<div className="border-border bg-background flex h-7 items-center rounded-2xl border text-xs shadow-xs">
			<FilterSubject column={column} />
			<Separator orientation="vertical" />
			<FilterOperator filter={filter} column={column} />
			<Separator orientation="vertical" />
			<FilterValue filter={filter} column={column} />
			<Separator orientation="vertical" />
			<Button
				variant="ghost"
				className="h-full w-7 rounded-none rounded-r-2xl text-xs"
				onClick={() => actions.removeFilter(filter.columnId)}
			>
				<XIcon className="size-4 -translate-x-0.5" />
			</Button>
		</div>
	);
}

export function ActiveFiltersMobileContainer({ children }: { children: ReactNode }) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [showLeftBlur, setShowLeftBlur] = useState(false);
	const [showRightBlur, setShowRightBlur] = useState(true);

	const checkScroll = () => {
		if (scrollContainerRef.current) {
			const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;

			setShowLeftBlur(scrollLeft > 0);

			setShowRightBlur(scrollLeft + clientWidth < scrollWidth - 1);
		}
	};

	useEffect(() => {
		if (scrollContainerRef.current) {
			const resizeObserver = new ResizeObserver(() => {
				checkScroll();
			});
			resizeObserver.observe(scrollContainerRef.current);
			return () => {
				resizeObserver.disconnect();
			};
		}
	}, []);

	useEffect(() => {
		checkScroll();
	}, [children]);

	return (
		<div className="relative w-full overflow-x-hidden">
			{showLeftBlur && (
				<div className="from-background animate-in fade-in-0 pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-16 bg-gradient-to-r to-transparent" />
			)}
			<div
				ref={scrollContainerRef}
				className="no-scrollbar flex gap-2 overflow-x-scroll"
				onScroll={checkScroll}
			>
				{children}
			</div>
			{showRightBlur && (
				<div className="from-background animate-in fade-in-0 pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-16 bg-gradient-to-l to-transparent" />
			)}
		</div>
	);
}
