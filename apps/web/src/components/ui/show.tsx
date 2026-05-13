import { type ReactNode } from "react";

type ShowProps<T> = {
	when: T | false | null | undefined;
	fallback?: ReactNode;
	children: ReactNode | ((value: NonNullable<T>) => ReactNode);
};

function Show<T>({ when, fallback = null, children }: ShowProps<T>) {
	if (!when) {
		return fallback;
	}

	if (typeof children === "function") {
		return children(when as NonNullable<T>);
	}

	return children;
}

export { Show };
