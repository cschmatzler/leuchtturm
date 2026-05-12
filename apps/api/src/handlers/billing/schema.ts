import * as Schema from "effect/Schema";

export namespace BillingSchema {
	export const SubscriptionOverview = Schema.Struct({
		currentPeriodEnd: Schema.Date,
		cancelAtPeriodEnd: Schema.Boolean,
	});

	export const OverviewResponse = Schema.Struct({
		activeSubscription: Schema.NullOr(SubscriptionOverview),
	});

	export const UrlResponse = Schema.Struct({
		url: Schema.String,
	});
}
