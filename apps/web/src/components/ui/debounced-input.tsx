import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useEffect, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { Input } from "@leuchtturm/web/components/ui/input";

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

	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setValue(newValue);
		debouncedCallback(newValue);
	};

	return <Input {...props} value={value} onChange={handleChange} />;
}
