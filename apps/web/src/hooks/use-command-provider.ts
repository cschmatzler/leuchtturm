import { useCallback, useEffect } from "react";

import type { Action } from "@leuchtturm/web/contexts/command-bar";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";

export function useCommandProvider(
	name: string,
	providerFn: (input: string) => Promise<Action[]>,
	dependencies: unknown[] = [],
) {
	const { register } = useCommandBar();
	const provider = useCallback(providerFn, [providerFn, ...dependencies]);

	useEffect(() => {
		const unregister = register(name, provider);
		return unregister;
	}, [name, register, provider]);
}
