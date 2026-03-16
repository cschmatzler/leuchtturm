import { useContext } from "react";

import { Context } from "@roasted/web/contexts/command-bar";

export function useCommandBar() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("No CommandBar context.");
	}

	return context;
}
