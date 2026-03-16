import { useDebouncedCallback } from "@tanstack/react-pacer";
import { type ChangeEvent, type InputHTMLAttributes } from "react";

import { Input } from "@one/web/components/ui/input";

export function DebouncedInput({
	value: initialValue,
	onChange,
	debounceMs = 100,
	...props
}: {
	value: string | number;
	onChange: (value: string | number) => void;
	debounceMs?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">) {
	const debouncedCallback = useDebouncedCallback(onChange, {
		wait: debounceMs,
	});

	const inputKey = `${typeof initialValue}:${initialValue}`;

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		debouncedCallback(newValue);
	};

	return <Input key={inputKey} {...props} defaultValue={initialValue} onChange={handleChange} />;
}
