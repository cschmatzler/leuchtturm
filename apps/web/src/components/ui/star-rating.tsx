import { StarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
	const { t } = useTranslation();
	const sizeClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

	return (
		<div
			className="flex gap-0.5"
			role="img"
			aria-label={t("Rating: {{rating}} out of 10", { rating })}
		>
			{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
				<StarIcon
					key={star}
					aria-hidden="true"
					className={`${sizeClass} ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
				/>
			))}
		</div>
	);
}

export function StarRatingInput({
	value,
	onChange,
}: {
	value: number | undefined;
	onChange: (rating: number | undefined) => void;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex items-center gap-1">
			{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
				<button
					key={star}
					type="button"
					aria-label={t("Rate {{star}} out of 10", { star })}
					aria-pressed={value !== undefined && star <= value}
					onClick={() => onChange(value === star ? undefined : star)}
					className="rounded p-0.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<StarIcon
						aria-hidden="true"
						className={`h-5 w-5 ${
							value && star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
						}`}
					/>
				</button>
			))}
			{value && (
				<button
					type="button"
					onClick={() => onChange(undefined)}
					className="text-muted-foreground ml-2 text-xs hover:underline"
				>
					{t("Clear")}
				</button>
			)}
		</div>
	);
}
