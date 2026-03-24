import { format as formatDate, isValid, parse } from "date-fns";
import { CalendarIcon, ClockIcon } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useState,
	type ChangeEvent,
	type ComponentProps,
} from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@chevrotain/web/components/ui/button";
import { Calendar } from "@chevrotain/web/components/ui/calendar";
import { FieldError } from "@chevrotain/web/components/ui/field";
import { Input } from "@chevrotain/web/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@chevrotain/web/components/ui/popover";

type DateInputProps = Omit<ComponentProps<"input">, "value" | "onChange"> & {
	value?: Date;
	onChange?: (newDate: Date | undefined) => void;
	format?: string;
	includeTime?: boolean;
	modal?: boolean;
};

function datesAreEqual(dateA?: Date, dateB?: Date): boolean {
	if (!dateA && !dateB) return true;
	if (!dateA || !dateB) return false;
	return dateA.getTime() === dateB.getTime();
}

function parseInput(value: string, format: string): Date | undefined {
	const parsed = parse(value, format, new Date());
	return isValid(parsed) ? parsed : undefined;
}

export function DateInput({
	value: parentDate,
	onChange,
	format: formatProp,
	includeTime = false,
	modal = false,
	...props
}: DateInputProps) {
	const { t } = useTranslation();
	const inputId = useId();

	const format = formatProp ?? (includeTime ? "yyyy-MM-dd HH:mm" : "yyyy-MM-dd");

	const [typedValue, setTypedValue] = useState("");
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
	const [visibleMonth, setVisibleMonth] = useState<Date>(parentDate ?? new Date());
	const [isInvalid, setIsInvalid] = useState(false);

	const clearSelection = useCallback(
		(shouldNotify = true) => {
			setTypedValue("");
			setSelectedDate(undefined);
			setVisibleMonth(new Date());
			setIsInvalid(false);

			if (shouldNotify) onChange?.(undefined);
		},
		[onChange],
	);

	const commitSelection = useCallback(
		(date: Date, options?: { notify?: boolean; formatInput?: boolean }) => {
			const { notify = true, formatInput = true } = options ?? {};

			if (formatInput) setTypedValue(formatDate(date, format));
			setSelectedDate(date);
			setVisibleMonth(date);
			setIsInvalid(false);

			if (notify) onChange?.(date);
		},
		[format, onChange],
	);

	useEffect(() => {
		if (datesAreEqual(parentDate, selectedDate)) return;

		if (!parentDate) {
			clearSelection(false);
			return;
		}

		commitSelection(parentDate, { notify: false });
	}, [parentDate, selectedDate, clearSelection, commitSelection]);

	const handleInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const inputValue = event.target.value;
			setTypedValue(inputValue);

			if (!inputValue.trim()) {
				clearSelection();
				return;
			}

			const parsedDate = parseInput(inputValue, format);
			if (!parsedDate) {
				setSelectedDate(undefined);
				setIsInvalid(true);
				onChange?.(undefined);
				return;
			}

			commitSelection(parsedDate, { formatInput: false });
		},
		[clearSelection, commitSelection, format, onChange],
	);

	const handleDayPickerSelect = useCallback(
		(date: Date | undefined) => {
			if (!date) {
				clearSelection();
				return;
			}

			if (includeTime) {
				const hours = selectedDate?.getHours() ?? new Date().getHours();
				const minutes = selectedDate?.getMinutes() ?? new Date().getMinutes();
				date.setHours(hours, minutes);
			}

			commitSelection(date);
		},
		[clearSelection, commitSelection, includeTime, selectedDate],
	);

	const handleTimeChange = useCallback(
		(hours: number, minutes: number) => {
			const base = selectedDate ? new Date(selectedDate.getTime()) : new Date();
			base.setHours(hours, minutes);
			commitSelection(base);
		},
		[commitSelection, selectedDate],
	);

	return (
		<div>
			<Popover modal={modal}>
				<div className={`relative ${includeTime ? "w-[280px]" : "w-[220px]"}`}>
					<Input
						id={inputId}
						value={typedValue}
						onChange={handleInputChange}
						aria-invalid={isInvalid}
						{...props}
					/>
					<PopoverTrigger
						render={
							<Button
								variant="ghost"
								className="absolute top-[50%] right-0 -translate-y-1/2 rounded-l-none px-2 active:-translate-y-1/2"
							/>
						}
					>
						<CalendarIcon className="text-dark-500 h-4 w-4" />
					</PopoverTrigger>
				</div>
				<PopoverContent className="w-auto p-0">
					<Calendar
						mode="single"
						captionLayout="dropdown"
						selected={selectedDate}
						onSelect={handleDayPickerSelect}
						month={visibleMonth}
						onMonthChange={setVisibleMonth}
					/>
					{includeTime && (
						<div className="border-border flex items-center justify-center gap-2 border-t px-3 py-2">
							<ClockIcon className="text-muted-foreground h-4 w-4" />
							<input
								type="number"
								min={0}
								max={23}
								value={String(selectedDate?.getHours() ?? 0).padStart(2, "0")}
								onChange={(event) =>
									handleTimeChange(
										Number.parseInt(event.target.value, 10) || 0,
										selectedDate?.getMinutes() ?? 0,
									)
								}
								className="border-border bg-background w-12 border text-center font-mono text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
							/>
							<span className="text-muted-foreground font-mono text-sm">:</span>
							<input
								type="number"
								min={0}
								max={59}
								value={String(selectedDate?.getMinutes() ?? 0).padStart(2, "0")}
								onChange={(event) =>
									handleTimeChange(
										selectedDate?.getHours() ?? 0,
										Number.parseInt(event.target.value, 10) || 0,
									)
								}
								className="border-border bg-background w-12 border text-center font-mono text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
							/>
						</div>
					)}
				</PopoverContent>
			</Popover>
			{isInvalid && (
				<FieldError className="mt-2">
					{t("Invalid date format. Please use {{format}} format.", { format })}
				</FieldError>
			)}
		</div>
	);
}
