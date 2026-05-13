import { isValidElement, type ReactNode } from "react";

const noMatch = Symbol("noMatch");

type FlowChildren<T> = ReactNode | ((value: NonNullable<T>) => ReactNode);

type ShowProps<T> = {
	when: T | false | null | undefined;
	fallback?: ReactNode;
	children: FlowChildren<T>;
};

function Show<T>(props: ShowProps<T>) {
	if (!props.when) {
		return props.fallback ?? null;
	}

	if (typeof props.children === "function") {
		return props.children(props.when as NonNullable<T>);
	}

	return props.children;
}

type SwitchProps = {
	fallback?: ReactNode;
	children: ReactNode;
};

type MatchProps<T> = {
	when: T | false | null | undefined;
	children: FlowChildren<T>;
};

function Switch(props: SwitchProps) {
	const match = resolveMatch(props.children);

	if (match === noMatch) {
		return props.fallback ?? null;
	}

	return match;
}

function Match<T>(_props: MatchProps<T>) {
	return null;
}

function resolveMatch(children: ReactNode): ReactNode | typeof noMatch {
	if (isValidElement<MatchProps<unknown>>(children)) {
		if (children.type !== Match) {
			return noMatch;
		}

		if (!children.props.when) {
			return noMatch;
		}

		if (typeof children.props.children === "function") {
			return children.props.children(children.props.when as NonNullable<unknown>);
		}

		return children.props.children;
	}

	if (!children || typeof children !== "object") {
		return noMatch;
	}

	if (Array.isArray(children)) {
		for (const child of children) {
			const match = resolveMatch(child);

			if (match !== noMatch) {
				return match;
			}
		}

		return noMatch;
	}

	const iterator = (children as Iterable<ReactNode>)[Symbol.iterator];

	if (typeof iterator !== "function") {
		return noMatch;
	}

	for (const child of children as Iterable<ReactNode>) {
		const match = resolveMatch(child);

		if (match !== noMatch) {
			return match;
		}
	}

	return noMatch;
}

export { Match, Show, Switch };
