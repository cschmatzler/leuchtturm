import { T, useGT } from "gt-react";
import { memo, useState } from "react";

import { useDataTableFilterContext } from "@leuchtturm/web/components/data-table-filter/context";
import { filterTypeOperatorDetails } from "@leuchtturm/web/components/data-table-filter/operators";
import type {
	Column,
	ColumnDataType,
	FilterModel,
	FilterOperators,
} from "@leuchtturm/web/components/data-table-filter/types";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@leuchtturm/web/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@leuchtturm/web/components/ui/popover";

export interface FilterOperatorProps<TData, TType extends ColumnDataType> {
	column: Column<TData, TType>;
	filter: FilterModel<TType>;
}

export function FilterOperator<TData, TType extends ColumnDataType>({
	column,
	filter,
}: FilterOperatorProps<TData, TType>) {
	const t = useGT();
	const operatorLabels: Record<string, string> = {
		is: t("is"),
		"is not": t("is not"),
		"is any of": t("is any of"),
		"is none of": t("is none of"),
		include: t("include"),
		exclude: t("exclude"),
		"include any of": t("include any of"),
		"exclude if all": t("exclude if all"),
		"include all of": t("include all of"),
		"exclude if any of": t("exclude if any of"),
		"is before": t("is before"),
		"is on or after": t("is on or after"),
		"is after": t("is after"),
		"is on or before": t("is on or before"),
		"is between": t("is between"),
		"is not between": t("is not between"),
		contains: t("contains"),
		"does not contain": t("does not contain"),
		"is greater than": t("is greater than"),
		"is greater than or equal to": t("is greater than or equal to"),
		"is less than": t("is less than"),
		"is less than or equal to": t("is less than or equal to"),
	};

	const [open, setOpen] = useState<boolean>(false);

	const close = () => setOpen(false);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						className="text-muted-foreground hover:text-accent-foreground m-0 h-full w-fit rounded-none p-0 px-2 text-xs whitespace-nowrap"
					/>
				}
			>
				<FilterOperatorDisplay
					filter={filter}
					columnType={column.type}
					operatorLabels={operatorLabels}
				/>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-fit origin-(--radix-popover-content-transform-origin) p-0"
			>
				<Command loop>
					<CommandInput placeholder={t("Search")} />
					<CommandEmpty>
						<T>No results</T>
					</CommandEmpty>
					<CommandList className="max-h-fit">
						<FilterOperatorController
							filter={filter}
							column={column}
							closeController={close}
							operatorLabels={operatorLabels}
						/>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface FilterOperatorDisplayProps<TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	columnType: TType;
	operatorLabels: Record<string, string>;
}

const FilterOperatorDisplayImpl = function FilterOperatorDisplay<TType extends ColumnDataType>({
	filter,
	columnType,
	operatorLabels,
}: FilterOperatorDisplayProps<TType>) {
	const operator = filterTypeOperatorDetails[columnType][filter.operator];
	const label = operatorLabels[operator.key] ?? operator.key;

	return <span>{label}</span>;
};

const FilterOperatorDisplay = memo(FilterOperatorDisplayImpl) as typeof FilterOperatorDisplayImpl;

interface FilterOperatorControllerProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	closeController: () => void;
	operatorLabels: Record<string, string>;
}

function FilterOperatorController<TData, TType extends ColumnDataType>({
	filter,
	column,
	closeController,
	operatorLabels,
}: FilterOperatorControllerProps<TData, TType>) {
	const t = useGT();
	const { actions } = useDataTableFilterContext();

	const operators = filterTypeOperatorDetails[column.type];
	const filterDetails = operators[filter.operator];
	const relatedFilters = Object.values(operators).filter(
		(o): o is { key: string; value: string; target: string } =>
			typeof o === "object" && o !== null && "target" in o && o.target === filterDetails.target,
	);

	const changeOperator = (value: string) => {
		actions?.setFilterOperator(column.id, value as FilterOperators[TType]);
		closeController();
	};

	return (
		<CommandGroup heading={t("Operators")}>
			{relatedFilters.map((r) => (
				<CommandItem onSelect={changeOperator} value={r.value} key={r.value}>
					{operatorLabels[r.key] ?? r.key}
				</CommandItem>
			))}
		</CommandGroup>
	);
}
