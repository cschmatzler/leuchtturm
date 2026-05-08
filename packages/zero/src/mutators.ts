import { defineMutator, defineMutatorsWithType } from "@rocicorp/zero";

import { type Schema } from "@leuchtturm/zero/schema";

export const mutators = defineMutatorsWithType<Schema>()({
	noop: defineMutator(async () => {}),
});

export type Mutators = typeof mutators;
