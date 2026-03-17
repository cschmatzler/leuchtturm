import { defineMutators } from "@chevrotain/zero/mutators/shared";
import { userMutators } from "@chevrotain/zero/mutators/user";

export const mutators = defineMutators({
	user: userMutators,
});

export type Mutators = typeof mutators;
