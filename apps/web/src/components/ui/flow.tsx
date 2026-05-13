import { Children, isValidElement, type ReactNode } from "react";

type FlowChildren<T> = ReactNode | ((value: NonNullable<T>) => ReactNode);

type ShowProps<T> = {
	when: T | false | null | undefined;
	fallback?: ReactNode;
	children: FlowChildren<T>;
};

type SwitchProps = {
	fallback?: ReactNode;
	children: ReactNode;
};

type MatchProps<T> = {
	when: T | false | null | undefined;
	children: FlowChildren<T>;
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

function Switch({ fallback = null, children }: SwitchProps) {
	for (const child of Children.toArray(children)) {
		if (!isValidElement<MatchProps<unknown>>(child) || child.type !== Match) {
			continue;
		}

		const { when, children: matchChildren } = child.props;

		if (!when) {
			continue;
		}

		if (typeof matchChildren === "function") {
			return matchChildren(when as NonNullable<unknown>);
		}

		return matchChildren;
	}

	return fallback;
}

function Match<T>(_props: MatchProps<T>) {
	return null;
}

export { Match, Show, Switch };
