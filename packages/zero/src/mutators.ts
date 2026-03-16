import { defineMutators } from "@roasted/zero/mutators/shared";
import { userMutators } from "@roasted/zero/mutators/user";

export const mutators = defineMutators({
	user: userMutators,
});

export type Mutators = typeof mutators;
