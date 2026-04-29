import { ArrowRightIcon, CaretRightIcon, FunnelIcon } from "@phosphor-icons/react";
import { Fragment, isValidElement, memo, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDataTableFilterContext } from "@leuchtturm/web/components/data-table-filter/context";
import { FilterValueController } from "@leuchtturm/web/components/data-table-filter/filter-value";
import { getColumn } from "@leuchtturm/web/components/data-table-filter/helpers";
import type { Column, ColumnDataType } from "@leuchtturm/web/components/data-table-filter/types";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Checkbox } from "@leuchtturm/web/components/ui/checkbox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@leuchtturm/web/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@leuchtturm/web/components/ui/popover";
import { isAnyOf } from "@leuchtturm/web/lib/array";
import { cn } from "@leuchtturm/web/lib/cn";

export function FilterSelector<TData>() {
	const { t } = useTranslation();
	const { filters, filterColumns } = useDataTableFilterContext<TData>();

	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const [property, setProperty] = useState<string | undefined>(undefined);
	const inputRef = useRef<HTMLInputElement>(null);

	const column = property ? getColumn(filterColumns, property) : undefined;
	const filter = property ? filters.find((f) => f.columnId === property) : undefined;

	const hasFilters = filters.length > 0;

	const handlePropertySelect = useCallback((nextProperty: string) => {
		inputRef.current?.focus();
		setValue("");
		setProperty(nextProperty);
	}, []);

	const content =
		property && column ? (
			<FilterValueController filter={filter!} column={column as Column<TData, ColumnDataType>} />
		) : (
			<Command
				loop
				filter={(value, search, keywords) => {
					const extendValue = `${value} ${keywords?.join(" ")}`;
					return extendValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
				}}
			>
				<CommandInput
					value={value}
					onValueChange={setValue}
					ref={inputRef}
					placeholder={t("Search")}
				/>
				<CommandEmpty>{t("No results")}</CommandEmpty>
				<CommandList className="max-h-fit">
					<CommandGroup>
						{filterColumns.map((column) => (
							<FilterableColumn
								key={column.id}
								column={column}
								setProperty={handlePropertySelect}
							/>
						))}
						<QuickSearchFilters search={value} />
					</CommandGroup>
				</CommandList>
			</Command>
		);

	return (
		<Popover
			open={open}
			onOpenChange={async (value) => {
				setOpen(value);
				if (!value) {
					setTimeout(() => setProperty(undefined), 100);
					setTimeout(() => setValue(""), 150);
				}
			}}
		>
			<PopoverTrigger
				render={<Button variant="outline" className={cn("h-7", hasFilters && "w-fit !px-2")} />}
			>
				<FunnelIcon className="size-4" />
				{!hasFilters && <span>{t("Filter")}</span>}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				className="w-fit origin-(--radix-popover-content-transform-origin) p-0"
			>
				{content}
			</PopoverContent>
		</Popover>
	);
}

export function FilterableColumn<TData, TType extends ColumnDataType, TVal>({
	column,
	setProperty,
}: {
	column: Column<TData, TType, TVal>;
	setProperty: (value: string) => void;
}) {
	const prefetch = useCallback(() => {
		column.prefetchOptions();
		column.prefetchValues();
		column.prefetchFacetedUniqueValues();
		column.prefetchFacetedMinMaxValues();
	}, [column]);

	return (
		<CommandItem
			value={column.id}
			keywords={[column.displayName]}
			onSelect={() => setProperty(column.id)}
			className="group"
			onMouseEnter={prefetch}
			onFocus={prefetch}
		>
			<div className="flex w-full items-center justify-between">
				<div className="inline-flex items-center gap-1.5">
					{<column.icon strokeWidth={2.25} className="size-4 text-current" />}
					<span>{column.displayName}</span>
				</div>
				<ArrowRightIcon className="size-4 text-current opacity-0 group-aria-selected:opacity-100" />
			</div>
		</CommandItem>
	);
}

export const QuickSearchFilters = memo(QuickSearchFiltersComponent);

function QuickSearchFiltersComponent<TData>({ search }: { search?: string }) {
	const { filters, filterColumns, actions } = useDataTableFilterContext<TData>();

	const optionColumns = filterColumns.filter((c) =>
		isAnyOf<ColumnDataType>(c.type, ["option", "multiOption"]),
	);

	if (!search || search.trim().length < 2) return null;

	return (
		<>
			{optionColumns.map((column) => {
				const filter = filters.find((f) => f.columnId === column.id);
				const options = column.getOptions();
				const optionsCount = column.getFacetedUniqueValues();

				function handleOptionSelect(value: string, check: boolean) {
					if (check) actions.addFilterValue(column, [value]);
					else actions.removeFilterValue(column, [value]);
				}

				return (
					<Fragment key={column.id}>
						{options.map((v) => {
							const checked = Boolean(filter?.values.includes(v.value));
							const count = optionsCount?.get(v.value) ?? 0;

							return (
								<CommandItem
									key={v.value}
									value={v.value}
									keywords={[v.label, v.value]}
									onSelect={() => {
										handleOptionSelect(v.value, !checked);
									}}
									className="group"
								>
									<div className="group flex items-center gap-1.5">
										<Checkbox
											checked={checked}
											className="dark:border-ring mr-1 opacity-0 group-data-[selected=true]:opacity-100 data-[checked]:opacity-100"
										/>
										<div className="flex w-4 items-center justify-center">
											{v.icon && (isValidElement(v.icon) ? v.icon : <v.icon className="size-4" />)}
										</div>
										<div className="flex items-center gap-0.5">
											<span className="text-muted-foreground">{column.displayName}</span>
											<CaretRightIcon className="text-muted-foreground/75 size-3.5" />
											<span>
												{v.label}
												<sup
													className={cn(
														!optionsCount && "hidden",
														"ml-0.5 tracking-tight text-current tabular-nums",
														count === 0 && "slashed-zero",
													)}
												>
													{count < 100 ? count : "100+"}
												</sup>
											</span>
										</div>
									</div>
								</CommandItem>
							);
						})}
					</Fragment>
				);
			})}
		</>
	);
}
