import { useDebouncedCallback } from "@tanstack/react-pacer";
import { addDays, format, isEqual } from "date-fns";
import { EllipsisIcon } from "lucide-react";
import { cloneElement, isValidElement, memo, useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { take } from "remeda";

import { useDataTableFilterContext } from "@one/web/components/data-table-filter/context";
import { createNumberRange } from "@one/web/components/data-table-filter/helpers";
import {
	dateFilterOperators,
	DEFAULT_OPERATORS,
	numberFilterOperators,
} from "@one/web/components/data-table-filter/operators";
import type {
	Column,
	ColumnDataType,
	ColumnOptionExtended,
	FilterModel,
	FilterOperatorTarget,
} from "@one/web/components/data-table-filter/types";
import { Button } from "@one/web/components/ui/button";
import { Calendar } from "@one/web/components/ui/calendar";
import { Checkbox } from "@one/web/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@one/web/components/ui/command";
import { DebouncedInput } from "@one/web/components/ui/debounced-input";
import { Popover, PopoverContent, PopoverTrigger } from "@one/web/components/ui/popover";
import { Slider } from "@one/web/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@one/web/components/ui/tabs";
import { cn } from "@one/web/lib/cn";

interface FilterValueProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
}

export const FilterValue = memo(__FilterValue) as typeof __FilterValue;

function __FilterValue<TData, TType extends ColumnDataType>({
	filter,
	column,
}: FilterValueProps<TData, TType>) {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						variant="ghost"
						className="m-0 h-full w-fit rounded-none p-0 px-2 text-xs whitespace-nowrap"
					/>
				}
			>
				<FilterValueDisplay filter={filter} column={column} />
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				className="w-fit origin-(--radix-popover-content-transform-origin) p-0"
			>
				<FilterValueController filter={filter} column={column} />
			</PopoverContent>
		</Popover>
	);
}

interface FilterValueDisplayProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
}

type OptionType = "option" | "multiOption";

function FilterValueDisplay<TData, TType extends ColumnDataType>({
	filter,
	column,
}: FilterValueDisplayProps<TData, TType>) {
	// TypeScript can't narrow generic TType through switch(column.type).
	// These casts are safe because the switch guarantees the correct branch.
	switch (column.type) {
		case "option":
		case "multiOption":
			return (
				<FilterValueOptionDisplay
					filter={filter as FilterModel<OptionType>}
					column={column as Column<TData, OptionType>}
				/>
			);
		case "date":
			return (
				<FilterValueDateDisplay
					filter={filter as FilterModel<"date">}
					column={column as Column<TData, "date">}
				/>
			);
		case "text":
			return (
				<FilterValueTextDisplay
					filter={filter as FilterModel<"text">}
					column={column as Column<TData, "text">}
				/>
			);
		case "number":
			return (
				<FilterValueNumberDisplay
					filter={filter as FilterModel<"number">}
					column={column as Column<TData, "number">}
				/>
			);
		default:
			return null;
	}
}

function FilterValueOptionDisplay<TData>({
	filter,
	column,
}: {
	filter: FilterModel<OptionType>;
	column: Column<TData, OptionType>;
}) {
	const options = column.getOptions();
	const selected = options.filter((o) => filter?.values.includes(o.value));

	if (selected.length === 1) {
		const { label, icon: Icon } = selected[0];
		const hasIcon = !!Icon;
		return (
			<span className="inline-flex items-center gap-1">
				{hasIcon && (isValidElement(Icon) ? Icon : <Icon className="size-4" />)}
				<span>{label}</span>
			</span>
		);
	}

	const name = column.displayName.toLowerCase();
	const pluralName =
		column.type === "option" ? (name.endsWith("s") ? `${name}es` : `${name}s`) : name;
	const hasOptionIcons = !options?.some((o) => !o.icon);

	return (
		<div className="inline-flex items-center gap-0.5">
			{hasOptionIcons && (
				<div className="inline-flex items-center gap-0.5">
					{take(selected, 3).map(({ value, icon }) => {
						const Icon = icon!;
						return isValidElement(Icon) ? (
							cloneElement(Icon, { key: value })
						) : (
							<Icon key={value} className="size-4" />
						);
					})}
				</div>
			)}
			<span className={cn(hasOptionIcons && "ml-1.5")}>
				{selected.length} {pluralName}
			</span>
		</div>
	);
}

function normalizeDateValue(value: unknown): Date | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return value;

	if (typeof value === "string" || typeof value === "number") {
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}

	return undefined;
}

function formatDateValue(value: unknown) {
	const date = normalizeDateValue(value);
	if (!date) return undefined;
	return format(date, "MMM d, yyyy");
}

function formatDateRange(startValue: unknown, endValue: unknown) {
	const start = normalizeDateValue(startValue);
	if (!start) return undefined;
	const end = normalizeDateValue(endValue) ?? start;

	const sameMonth = start.getMonth() === end.getMonth();
	const sameYear = start.getFullYear() === end.getFullYear();

	if (sameMonth && sameYear) {
		return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
	}

	if (sameYear) {
		return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
	}

	return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

function FilterValueDateDisplay<TData>({ filter }: FilterValueDisplayProps<TData, "date">) {
	if (!filter) return null;
	if (filter.values.length === 0) return <EllipsisIcon className="size-4" />;
	if (filter.values.length === 1) {
		const single = formatDateValue(filter.values[0]);

		if (!single) return <EllipsisIcon className="size-4" />;

		return <span>{single}</span>;
	}

	const formattedRangeStr = formatDateRange(filter.values[0], filter.values[1]);

	if (!formattedRangeStr) return <EllipsisIcon className="size-4" />;

	return <span>{formattedRangeStr}</span>;
}

function FilterValueTextDisplay<TData>({ filter }: FilterValueDisplayProps<TData, "text">) {
	if (!filter) return null;
	if (filter.values.length === 0 || filter.values[0].trim() === "")
		return <EllipsisIcon className="size-4" />;

	const value = filter.values[0];

	return <span>{value}</span>;
}

function FilterValueNumberDisplay<TData>({ filter }: FilterValueDisplayProps<TData, "number">) {
	const { t } = useTranslation();

	if (!filter || !filter.values || filter.values.length === 0) return null;

	if (filter.operator === "is between" || filter.operator === "is not between") {
		const minValue = filter.values[0];
		const maxValue = filter.values[1];

		return (
			<span className="tracking-tight tabular-nums">
				{minValue} {t("and")} {maxValue}
			</span>
		);
	}

	const value = filter.values[0];
	return <span className="tracking-tight tabular-nums">{value}</span>;
}

/****** Property Filter Value Controller ******/

interface FilterValueControllerProps<TData, TType extends ColumnDataType> {
	filter: FilterModel<TType>;
	column: Column<TData, TType>;
}

export const FilterValueController = memo(
	__FilterValueController,
) as typeof __FilterValueController;

function __FilterValueController<TData, TType extends ColumnDataType>({
	filter,
	column,
}: FilterValueControllerProps<TData, TType>) {
	// TypeScript can't narrow generic TType through switch(column.type).
	// These casts are safe because the switch guarantees the correct branch.
	switch (column.type) {
		case "option":
		case "multiOption":
			return (
				<FilterValueOptionController
					filter={filter as FilterModel<OptionType>}
					column={column as Column<TData, OptionType>}
				/>
			);
		case "date":
			return (
				<FilterValueDateController
					filter={filter as FilterModel<"date">}
					column={column as Column<TData, "date">}
				/>
			);
		case "text":
			return (
				<FilterValueTextController
					filter={filter as FilterModel<"text">}
					column={column as Column<TData, "text">}
				/>
			);
		case "number":
			return (
				<FilterValueNumberController
					filter={filter as FilterModel<"number">}
					column={column as Column<TData, "number">}
				/>
			);
		default:
			return null;
	}
}

interface OptionItemProps {
	option: ColumnOptionExtended;
	onToggle: (value: string, checked: boolean) => void;
}

const OptionItem = memo(function OptionItem({ option, onToggle }: OptionItemProps) {
	const { value, label, icon: Icon, selected, count } = option;
	const handleSelect = useCallback(() => {
		onToggle(value, !selected);
	}, [onToggle, value, selected]);

	return (
		<CommandItem
			key={value}
			onSelect={handleSelect}
			className="group flex items-center justify-between gap-1.5"
		>
			<div className="flex items-center gap-1.5">
				<Checkbox
					checked={selected}
					className="dark:border-ring mr-1 opacity-0 group-data-[selected=true]:opacity-100 data-[checked]:opacity-100"
				/>
				{Icon && (isValidElement(Icon) ? Icon : <Icon className="size-4" />)}
				<span>
					{label}
					<sup
						className={cn(
							count == null && "hidden",
							"ml-0.5 tracking-tight text-current tabular-nums",
							count === 0 && "slashed-zero",
						)}
					>
						{typeof count === "number" ? (count < 100 ? count : "100+") : ""}
					</sup>
				</span>
			</div>
		</CommandItem>
	);
});

function FilterValueOptionController<TData>({
	filter,
	column,
}: {
	filter: FilterModel<OptionType>;
	column: Column<TData, OptionType>;
}) {
	const { t } = useTranslation();
	const { actions } = useDataTableFilterContext();

	const facetedCounts = column.getFacetedUniqueValues();
	const options = useMemo(
		() =>
			column.getOptions().map((o) => ({
				...o,
				selected: filter?.values.includes(o.value) ?? false,
				count: facetedCounts?.get(o.value) ?? 0,
			})),
		[column, filter?.values, facetedCounts],
	);

	const handleToggle = useCallback(
		(value: string, checked: boolean) => {
			if (checked) actions.addFilterValue(column, [value]);
			else actions.removeFilterValue(column, [value]);
		},
		[actions, column],
	);

	const selectedOptions = options.filter((o) => o.selected);
	const unselectedOptions = options.filter((o) => !o.selected);

	return (
		<Command loop>
			<CommandInput autoFocus placeholder={t("Search")} />
			<CommandEmpty>{t("No results")}</CommandEmpty>
			<CommandList className="max-h-fit">
				<CommandGroup className={cn(selectedOptions.length === 0 && "hidden")}>
					{selectedOptions.map((option) => (
						<OptionItem key={option.value} option={option} onToggle={handleToggle} />
					))}
				</CommandGroup>
				<CommandSeparator />
				<CommandGroup className={cn(unselectedOptions.length === 0 && "hidden")}>
					{unselectedOptions.map((option) => (
						<OptionItem key={option.value} option={option} onToggle={handleToggle} />
					))}
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

function FilterValueDateController<TData>({
	filter,
	column,
}: FilterValueControllerProps<TData, "date">) {
	const { t } = useTranslation();
	const { actions } = useDataTableFilterContext();
	type DateTabValue = "single" | "range";
	type DateOperator = keyof typeof dateFilterOperators;

	const operator: DateOperator = filter
		? (filter.operator as DateOperator)
		: (DEFAULT_OPERATORS.date.single as DateOperator);
	const values = (filter ? filter.values : []) as FilterModel<"date">["values"];
	const activeTarget = dateFilterOperators[operator].target;
	const derivedTab: DateTabValue = activeTarget === "multiple" ? "range" : "single";
	const tabValue = derivedTab;

	const datesEqual = useCallback((a?: Date, b?: Date) => {
		if (!a && !b) return true;
		if (!a || !b) return false;
		return isEqual(a, b);
	}, []);

	const resolveOperator = useCallback(
		(target: FilterOperatorTarget): DateOperator => {
			const currentDetails = dateFilterOperators[operator];

			if (currentDetails.target === target) return operator;

			if (target === "multiple") {
				if ("singularOf" in currentDetails && currentDetails.singularOf) {
					return currentDetails.singularOf;
				}
				const matchingEntry = Object.entries(dateFilterOperators).find(
					([, details]) =>
						details.target === "multiple" && "pluralOf" in details && details.pluralOf === operator,
				);
				if (matchingEntry) return matchingEntry[0] as DateOperator;
			} else {
				if ("pluralOf" in currentDetails && currentDetails.pluralOf) {
					return currentDetails.pluralOf;
				}
				const matchingEntry = Object.entries(dateFilterOperators).find(
					([, details]) =>
						details.target === "single" &&
						"singularOf" in details &&
						details.singularOf === operator,
				);
				if (matchingEntry) return matchingEntry[0] as DateOperator;
			}

			return DEFAULT_OPERATORS.date[target] as DateOperator;
		},
		[operator],
	);

	const single = values[0];
	const rangeTo = activeTarget === "multiple" ? values[1] : undefined;
	const range: DateRange | undefined = !single
		? undefined
		: activeTarget === "multiple"
			? { from: single, to: rangeTo }
			: { from: single, to: undefined };

	const changeSingleDate = useCallback(
		(value: Date | undefined) => {
			actions.setFilterValue(column, value ? [value] : []);
		},
		[actions, column],
	);

	const changeDateRange = useCallback(
		(value: DateRange | undefined) => {
			const start = value?.from;
			const end = start && value?.to && !datesEqual(start, value.to) ? value.to : undefined;

			if (!start) {
				actions.setFilterValue(column, []);
				return;
			}

			const newValues = end ? [start, end] : [start];
			actions.setFilterValue(column, newValues);
		},
		[actions, column, datesEqual],
	);

	const changeType = useCallback(
		(nextTab: DateTabValue) => {
			const nextTarget: FilterOperatorTarget = nextTab === "range" ? "multiple" : "single";
			const nextOperator = resolveOperator(nextTarget);
			const base = single ?? new Date();

			if (nextTarget === "single") {
				actions.setFilterValue(column, [base]);
				if (operator !== nextOperator || !filter)
					actions.setFilterOperator(column.id, nextOperator);
				return;
			}

			const rawTo = rangeTo ?? addDays(base, 1);
			const ensuredTo = datesEqual(rawTo, base) ? addDays(base, 1) : rawTo;
			const nextRange: DateRange = { from: base, to: ensuredTo };

			actions.setFilterValue(column, [nextRange.from!, nextRange.to!]);
			if (operator !== nextOperator || !filter) actions.setFilterOperator(column.id, nextOperator);
		},
		[actions, column, datesEqual, filter, operator, rangeTo, resolveOperator, single],
	);

	return (
		<Command>
			<CommandList className="max-h-fit">
				<CommandGroup>
					<div className="flex w-full flex-col">
						<Tabs value={tabValue} onValueChange={(tab) => changeType(tab as DateTabValue)}>
							<TabsList className="w-full *:text-xs">
								<TabsTrigger value="single">{t("Single")}</TabsTrigger>
								<TabsTrigger value="range">{t("Range")}</TabsTrigger>
							</TabsList>
							<TabsContent value="single">
								<Calendar
									autoFocus
									mode="single"
									captionLayout="dropdown"
									defaultMonth={single ?? new Date()}
									selected={single}
									onSelect={changeSingleDate}
									numberOfMonths={1}
								/>
							</TabsContent>
							<TabsContent value="range">
								<Calendar
									autoFocus
									mode="range"
									captionLayout="dropdown"
									defaultMonth={range?.from ?? single ?? new Date()}
									selected={range}
									onSelect={changeDateRange}
									numberOfMonths={1}
								/>
							</TabsContent>
						</Tabs>
					</div>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

function FilterValueTextController<TData>({
	filter,
	column,
}: FilterValueControllerProps<TData, "text">) {
	const { t } = useTranslation();
	const { actions } = useDataTableFilterContext();

	const changeText = (value: string | number) => {
		actions.setFilterValue(column, [String(value)]);
	};

	return (
		<Command>
			<CommandList className="max-h-fit">
				<CommandGroup>
					<CommandItem>
						<DebouncedInput
							placeholder={t("Search")}
							autoFocus
							value={filter?.values[0] ?? ""}
							onChange={changeText}
						/>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}

function FilterValueNumberController<TData>({
	filter,
	column,
}: FilterValueControllerProps<TData, "number">) {
	const { t } = useTranslation();
	const { actions } = useDataTableFilterContext();

	const minMax = column.getFacetedMinMaxValues();
	const [sliderMin, sliderMax] = [minMax ? minMax[0] : 0, minMax ? minMax[1] : 0];

	const filterValues = filter?.values;
	const [values, setValues] = useState(() => filterValues ?? [0, 0]);
	const [previousFilterValues, setPreviousFilterValues] = useState(filterValues);

	if (filterValues !== previousFilterValues) {
		setPreviousFilterValues(filterValues);
		setValues(filterValues ?? [0, 0]);
	}

	const isNumberRange = filter && numberFilterOperators[filter.operator].target === "multiple";

	const debouncedSetValue = useDebouncedCallback(
		(values: number[]) => actions.setFilterValue(column, values),
		{ wait: 200 },
	);

	const changeNumber = (value: number[]) => {
		setValues(value);
		debouncedSetValue(value);
	};

	const changeMinNumber = (value: number) => {
		const newValues = createNumberRange([value, values[1]]);
		setValues(newValues);
		debouncedSetValue(newValues);
	};

	const changeMaxNumber = (value: number) => {
		const newValues = createNumberRange([values[0], value]);
		setValues(newValues);
		debouncedSetValue(newValues);
	};

	const changeType = useCallback(
		(type: "single" | "range") => {
			let newValues: number[] = [];
			if (type === "single") newValues = [values[0]];
			else if (!minMax) newValues = createNumberRange([values[0], values[1] ?? 0]);
			else {
				const value = values[0];
				newValues =
					value - minMax[0] < minMax[1] - value
						? createNumberRange([value, minMax[1]])
						: createNumberRange([minMax[0], value]);
			}

			const newOperator = type === "single" ? "is" : "is between";

			setValues(newValues);

			actions.setFilterOperator(column.id, newOperator);
			actions.setFilterValue(column, newValues);
		},
		[values, column, actions, minMax],
	);

	return (
		<Command>
			<CommandList className="w-[300px] px-2 py-2">
				<CommandGroup>
					<div className="flex w-full flex-col">
						<Tabs
							value={isNumberRange ? "range" : "single"}
							onValueChange={(v) => changeType(v as "single" | "range")}
						>
							<TabsList className="w-full *:text-xs">
								<TabsTrigger value="single">{t("Single")}</TabsTrigger>
								<TabsTrigger value="range">{t("Range")}</TabsTrigger>
							</TabsList>
							<TabsContent value="single" className="mt-4 flex flex-col gap-4">
								{minMax && (
									<Slider
										value={[values[0]]}
										onValueChange={(value) => changeNumber(Array.isArray(value) ? value : [value])}
										min={sliderMin}
										max={sliderMax}
										step={1}
										aria-orientation="horizontal"
									/>
								)}
								<div className="flex items-center gap-2">
									<span className="text-xs font-medium">{t("Value")}</span>
									<DebouncedInput
										id="single"
										type="number"
										value={values[0].toString()}
										onChange={(v) => changeNumber([Number(v)])}
									/>
								</div>
							</TabsContent>
							<TabsContent value="range" className="mt-4 flex flex-col gap-4">
								{minMax && (
									<Slider
										value={values}
										onValueChange={(value) => changeNumber(Array.isArray(value) ? value : [value])}
										min={sliderMin}
										max={sliderMax}
										step={1}
										aria-orientation="horizontal"
									/>
								)}
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium">{t("min")}</span>
										<DebouncedInput
											type="number"
											value={values[0]}
											onChange={(v) => changeMinNumber(Number(v))}
										/>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium">{t("max")}</span>
										<DebouncedInput
											type="number"
											value={values[1]}
											onChange={(v) => changeMaxNumber(Number(v))}
										/>
									</div>
								</div>
							</TabsContent>
						</Tabs>
					</div>
				</CommandGroup>
			</CommandList>
		</Command>
	);
}
