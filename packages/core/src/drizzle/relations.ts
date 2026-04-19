import { defineRelationsPart } from "drizzle-orm";

import { account, session, user, verification } from "@leuchtturm/core/auth/auth.sql";
import {
	billingCustomer,
	billingOrder,
	billingSubscription,
} from "@leuchtturm/core/billing/billing.sql";

export const relations = defineRelationsPart(
	{
		user,
		session,
		account,
		verification,
		billingCustomer,
		billingSubscription,
		billingOrder,
	},
	(r) => ({
		user: {
			sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			billingCustomer: r.one.billingCustomer({
				from: r.user.id,
				to: r.billingCustomer.userId,
			}),
			billingSubscriptions: r.many.billingSubscription({
				from: r.user.id,
				to: r.billingSubscription.userId,
			}),
			billingOrders: r.many.billingOrder({ from: r.user.id, to: r.billingOrder.userId }),
		},
		session: {
			user: r.one.user({ from: r.session.userId, to: r.user.id }),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},
		verification: {},
		billingCustomer: {
			user: r.one.user({ from: r.billingCustomer.userId, to: r.user.id }),
			subscriptions: r.many.billingSubscription({
				from: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
				to: [r.billingSubscription.userId, r.billingSubscription.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
				to: [r.billingOrder.userId, r.billingOrder.polarCustomerId],
			}),
		},
		billingSubscription: {
			user: r.one.user({ from: r.billingSubscription.userId, to: r.user.id }),
			customer: r.one.billingCustomer({
				from: [r.billingSubscription.userId, r.billingSubscription.polarCustomerId],
				to: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingSubscription.id, r.billingSubscription.userId],
				to: [r.billingOrder.subscriptionId, r.billingOrder.userId],
			}),
		},
		billingOrder: {
			user: r.one.user({ from: r.billingOrder.userId, to: r.user.id }),
			customer: r.one.billingCustomer({
				from: [r.billingOrder.userId, r.billingOrder.polarCustomerId],
				to: [r.billingCustomer.userId, r.billingCustomer.polarCustomerId],
			}),
			subscription: r.one.billingSubscription({
				from: [r.billingOrder.subscriptionId, r.billingOrder.userId],
				to: [r.billingSubscription.id, r.billingSubscription.userId],
			}),
		},
	}),
);
