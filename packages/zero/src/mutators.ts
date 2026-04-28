import { defineMutator } from "@rocicorp/zero";

import { defineMutators } from "@leuchtturm/zero/mutators/shared";

export const mutators = defineMutators({
	noop: defineMutator(async () => {}),
});

export type Mutators = typeof mutators;
