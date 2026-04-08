import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { Route } from "@leuchtturm/web/pages/_app";
import { sessionQuery } from "@leuchtturm/web/queries/session";

describe("app route auth caching", () => {
	it("keeps the session query fresh for five minutes", () => {
		expect(sessionQuery().staleTime).toBe(5 * 60 * 1000);
	});

	it("reuses a fresh cached session in beforeLoad", async () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});
		const session = {
			session: { token: "session-token" },
			user: { id: "user-1" },
		};
		queryClient.setQueryData(["session"], session);

		const result = await Route.options.beforeLoad?.({
			context: { queryClient },
		} as never);

		expect(result).toEqual({ session });
	});
});
