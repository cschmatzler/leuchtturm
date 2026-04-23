import { describe, expect, it } from "vite-plus/test";

import { buildOrganizationCustomerCreate } from "@leuchtturm/core/billing";

describe("billing customer payloads", () => {
	it("includes the organization creator as the team owner", () => {
		expect(
			buildOrganizationCustomerCreate({
				organizationId: "org_01ARZ3NDEKTSV4RRFFQ69G5FAV",
				name: "Sopa",
				slug: "sopa",
				ownerEmail: "owner@example.com",
				ownerName: "Ada Lovelace",
			}),
		).toEqual({
			type: "team",
			externalId: "org_01ARZ3NDEKTSV4RRFFQ69G5FAV",
			name: "Sopa",
			metadata: { slug: "sopa" },
			owner: {
				email: "owner@example.com",
				name: "Ada Lovelace",
			},
		});
	});
});
