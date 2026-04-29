import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();

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
				<FilterOperatorDisplay filter={filter} columnType={column.type} />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-fit origin-(--radix-popover-content-transform-origin) p-0"
			>
				<Command loop>
					<CommandInput placeholder={t("Search")} />
					<CommandEmpty>{t("No results")}</CommandEmpty>
					<CommandList className="max-h-fit">
						<FilterOperatorController filter={filter} column={column} closeController={close} />
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

interface FilterOperatorDisplayProps<TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	columnType: TType;
}

const FilterOperatorDisplayImpl = function FilterOperatorDisplay<TType extends ColumnDataType>({
	filter,
	columnType,
}: FilterOperatorDisplayProps<TType>) {
	const { t } = useTranslation();

	const operator = filterTypeOperatorDetails[columnType][filter.operator];
	const label = t(operator.key);

	return <span>{label}</span>;
};

const FilterOperatorDisplay = memo(FilterOperatorDisplayImpl) as typeof FilterOperatorDisplayImpl;

interface FilterOperatorControllerProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
	closeController: () => void;
}

function FilterOperatorController<TData, TType extends ColumnDataType>({
	filter,
	column,
	closeController,
}: FilterOperatorControllerProps<TData, TType>) {
	const { t } = useTranslation();
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
					{t(r.key)}
				</CommandItem>
			))}
		</CommandGroup>
	);
}
