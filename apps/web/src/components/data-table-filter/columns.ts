import type { Column } from "@leuchtturm/web/components/data-table-filter/types";

export function getColumn<TData>(filterColumns: Column<TData>[], id: string) {
	const column = filterColumns.find((c) => c.id === id);

	if (!column) {
		throw new Error(`Column with ID ${id} not found.`);
	}

	return column;
}
