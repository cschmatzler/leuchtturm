import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Match, Show, Switch } from "@leuchtturm/web/components/ui/flow";

afterEach(() => {
	cleanup();
});

describe("Show", () => {
	it("renders children when the condition is truthy", () => {
		render(<Show when={true}>Visible</Show>);

		expect(screen.getByText("Visible")).toBeDefined();
	});

	it("renders the fallback when the condition is falsy", () => {
		render(
			<Show when={false} fallback="Fallback">
				Visible
			</Show>,
		);

		expect(screen.getByText("Fallback")).toBeDefined();
		expect(screen.queryByText("Visible")).toBeNull();
	});

	it("passes the condition value to function children", () => {
		render(<Show when={{ name: "Beacon" }}>{(project) => project.name}</Show>);

		expect(screen.getByText("Beacon")).toBeDefined();
	});
});

describe("Switch", () => {
	it("renders the first matching child", () => {
		render(
			<Switch fallback="Fallback">
				<Match when={false}>Hidden</Match>
				<Match when={true}>Visible</Match>
				<Match when={true}>Later</Match>
			</Switch>,
		);

		expect(screen.getByText("Visible")).toBeDefined();
		expect(screen.queryByText("Hidden")).toBeNull();
		expect(screen.queryByText("Later")).toBeNull();
		expect(screen.queryByText("Fallback")).toBeNull();
	});

	it("renders the fallback when no children match", () => {
		render(
			<Switch fallback="Fallback">
				<Match when={false}>Hidden</Match>
				<Match when={null}>Missing</Match>
			</Switch>,
		);

		expect(screen.getByText("Fallback")).toBeDefined();
		expect(screen.queryByText("Hidden")).toBeNull();
		expect(screen.queryByText("Missing")).toBeNull();
	});

	it("passes the matching value to function children", () => {
		render(
			<Switch>
				<Match when={{ name: "Beacon" }}>{(project) => project.name}</Match>
			</Switch>,
		);

		expect(screen.getByText("Beacon")).toBeDefined();
	});
});
