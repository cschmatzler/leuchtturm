import { defineMutators } from "@one/zero/mutators/shared";
import { userMutators } from "@one/zero/mutators/user";

export const mutators = defineMutators({
	user: userMutators,
});

export type Mutators = typeof mutators;
