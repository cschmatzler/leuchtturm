import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

type LocalStorageOptions<T> = {
	serialize?: (value: T) => string;
	deserialize?: (value: string) => T;
};

export function useLocalStorage<T>(
	key: string,
	defaultValue: T,
	{ serialize = JSON.stringify, deserialize }: LocalStorageOptions<T> = {},
) {
	const parse =
		deserialize ??
		((value: string) => {
			return JSON.parse(value) as T;
		});

	const [storedValue, setStoredValue] = useState<T>(() => {
		const stored = window.localStorage.getItem(key);
		if (stored === null) {
			return defaultValue;
		}
		return parse(stored);
	});
	const shouldPersistRef = useRef(false);

	const setValue = useCallback(
		(update: SetStateAction<T>) => {
			shouldPersistRef.current = true;
			setStoredValue(update);
		},
		[setStoredValue],
	);

	useEffect(() => {
		if (!shouldPersistRef.current) {
			return;
		}

		shouldPersistRef.current = false;
		window.localStorage.setItem(key, serialize(storedValue));
	}, [key, serialize, storedValue]);

	return [storedValue, setValue] as const;
}
