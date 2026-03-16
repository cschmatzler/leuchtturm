import { flexRender, type Table as TanStackTable } from "@tanstack/react-table";
import { createElement, type ComponentType } from "react";

import { DataTableFilter, type DataTableFilterProps } from "@one/web/components/data-table-filter";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@one/web/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@one/web/components/ui/table";
import { cn } from "@one/web/lib/cn";

export function DataTable<TData>({
	table,
	filterColumns,
	filters,
	actions,
	onRowClick,
	className,
	emptyIcon,
	emptyRowName,
}: {
	table: TanStackTable<TData>;
	onRowClick?: (row: TData) => void;
	className?: string;
	emptyIcon: ComponentType<{ className?: string }>;
	emptyRowName?: string;
} & DataTableFilterProps<TData>) {
	const { rows } = table.getRowModel();

	return (
		<div className={cn("flex w-full flex-col gap-5", className)}>
			<div className="overflow-visible">
				<DataTableFilter filters={filters} filterColumns={filterColumns} actions={actions} />
			</div>
			<div className="w-0 min-w-full overflow-hidden">
				{rows.length === 0 ? (
					<Empty>
						<EmptyContent>
							<EmptyMedia variant="icon">
								{createElement(emptyIcon, { className: "size-6" })}
							</EmptyMedia>
							<EmptyTitle>No data</EmptyTitle>
							<EmptyDescription>
								There are no {emptyRowName || "items"} to display.
							</EmptyDescription>
						</EmptyContent>
					</Empty>
				) : (
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead
												key={header.id}
												style={{
													width:
														header.getSize() === Number.MAX_SAFE_INTEGER
															? "auto"
															: header.getSize(),
												}}
											>
												{header.isPlaceholder
													? null
													: flexRender(header.column.columnDef.header, header.getContext())}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className={onRowClick ? "cursor-pointer" : undefined}
									role={onRowClick ? "button" : undefined}
									tabIndex={onRowClick ? 0 : undefined}
									onClick={() => onRowClick?.(row.original)}
									onKeyDown={
										onRowClick
											? (e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														onRowClick(row.original);
													}
												}
											: undefined
									}
								>
									{row.getVisibleCells().map((cell) => {
										return (
											<TableCell
												key={cell.id}
												style={{
													width:
														cell.column.getSize() === Number.MAX_SAFE_INTEGER
															? "auto"
															: cell.column.getSize(),
												}}
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										);
									})}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>
		</div>
	);
}
