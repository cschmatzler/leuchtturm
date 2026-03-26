import { ulid } from "ulid";

export type IdPrefix =
	| "usr_"
	| "ses_"
	| "acc_"
	| "ver_"
	| "jwk_"
	| "mac_"
	| "mfl_"
	| "mlb_"
	| "mcv_"
	| "mmg_"
	| "mbp_"
	| "mmb_"
	| "mat_"
	| "msc_"
	| "mps_";

export function createId(prefix: IdPrefix): string {
	return `${prefix}${ulid()}`;
}
