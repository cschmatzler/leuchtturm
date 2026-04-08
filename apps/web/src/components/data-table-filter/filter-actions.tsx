import { FunnelXIcon } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { useDataTableFilterContext } from "@leuchtturm/web/components/data-table-filter/context";
import { Button } from "@leuchtturm/web/components/ui/button";
import { cn } from "@leuchtturm/web/lib/cn";

export const FilterActions = memo(FilterActionsComponent);
function FilterActionsComponent() {
	const { t } = useTranslation();
	const { actions, filters } = useDataTableFilterContext();
	const hasFilters = filters.length > 0;

	return (
		<Button
			className={cn("h-7 !px-2", !hasFilters && "hidden")}
			variant="outline"
			onClick={actions?.removeAllFilters}
		>
			<FunnelXIcon />
			<span className="hidden md:block">{t("Clear")}</span>
		</Button>
	);
}
