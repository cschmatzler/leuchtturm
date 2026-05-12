import * as Schema from "effect/Schema";

import { OrganizationSelect } from "@leuchtturm/core/auth/schema";
import { SubscriptionSelect } from "@leuchtturm/core/billing/schema";

export namespace BillingSchema {
	export const OrganizationQuery = Schema.Struct({
		organizationId: OrganizationSelect.fields.id,
	});

	export const OverviewResponse = Schema.Struct({
		activeSubscription: Schema.NullOr(
			Schema.Struct({
				currentPeriodEnd: SubscriptionSelect.fields.currentPeriodEnd,
				cancelAtPeriodEnd: SubscriptionSelect.fields.cancelAtPeriodEnd,
			}),
		),
	});
}
