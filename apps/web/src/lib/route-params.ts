export function parsePrefixedId<T extends string>(value: string, prefix: string): T {
	return (value.startsWith(prefix) ? value : `${prefix}${value}`) as T;
}

export function stringifyPrefixedId(value: string, prefix: string) {
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
