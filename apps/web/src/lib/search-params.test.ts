import { describe, expect, it } from "vitest";

import { parseSearch, stringifySearch } from "@leuchtturm/web/lib/search-params";

describe("router search params", () => {
	it("roundtrips scalars and filters", () => {
		const search = {
			page: 2,
			showInactive: false,
			filters: [
				{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
				{ columnId: "email", type: "text", operator: "contains", values: ["a,b.test"] },
			],
		};

		const str = stringifySearch(search);
		const parsed = parseSearch(str);

		expect(parsed).toEqual(search);
	});

	it("groups filter params by prefix", () => {
		const parsed = parseSearch("?filters.name.t.c=John&mfilters.email.t.c=test&page=1");

		expect(parsed).toEqual({
			filters: [{ columnId: "name", type: "text", operator: "contains", values: ["John"] }],
			mfilters: [{ columnId: "email", type: "text", operator: "contains", values: ["test"] }],
			page: 1,
		});
	});

	it("leaves arrays with non-filter items as scalar search params", () => {
		const items = [
			{ columnId: "lastName", type: "text", operator: "contains", values: ["r"] },
			{ columnId: "status", type: "unknown", operator: "contains", values: ["active"] },
		];

		const str = stringifySearch({ items });

		expect(new URLSearchParams(str).get("items")).toBe(JSON.stringify(items));
	});
});
