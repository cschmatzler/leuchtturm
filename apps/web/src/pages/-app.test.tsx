import { QueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { OrganizationId } from "@leuchtturm/core/auth/schema";
import { Route } from "@leuchtturm/web/pages/app";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

describe("app route auth caching", () => {
	it("keeps the session query fresh for five minutes", () => {
		expect(sessionQuery().staleTime).toBe(5 * 60 * 1000);
	});

	it("reuses cached session and organizations in beforeLoad", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});
		const session = {
			session: { token: "session-token" },
			user: { id: "user-1" },
		};
		const organizationId = Schema.decodeSync(OrganizationId)("org_01ARZ3NDEKTSV4RRFFQ69G5FAV");
		queryClient.setQueryData(["session"], session);
		queryClient.setQueryData(organizationsQuery(session as never).queryKey, [
			{ id: organizationId, name: "Acme", slug: "acme", createdAt: Date.now() },
		]);

		await expect(
			Route.options.beforeLoad?.({
				context: { queryClient },
			} as never),
		).rejects.toMatchObject({
			status: 307,
			options: {
				to: "/$organization/settings",
				params: { organization: "acme" },
			},
		});
	});
});
