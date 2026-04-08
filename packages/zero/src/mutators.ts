import { defineMutators } from "@leuchtturm/zero/mutators/shared";
import { userMutators } from "@leuchtturm/zero/mutators/user";

export const mutators = defineMutators({
	user: userMutators,
});

export type Mutators = typeof mutators;
