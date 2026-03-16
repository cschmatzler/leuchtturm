import { hc } from "hono/client";

import type { Routes } from "@one/api/index";

export const { api } = hc<Routes>(import.meta.env.VITE_BASE_URL!, {
	init: {
		credentials: "include",
	},
});
