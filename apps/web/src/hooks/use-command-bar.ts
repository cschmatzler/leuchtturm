import { useContext } from "react";

import { Context } from "@chevrotain/web/contexts/command-bar";

export function useCommandBar() {
	const context = useContext(Context);
	if (!context) {
		throw new Error("No CommandBar context.");
	}

	return context;
}
