import type { WebhooksOptions } from "@polar-sh/better-auth";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";

import { user } from "@chevrotain/core/auth/auth.sql";
import {
	billingCustomer,
	billingOrder,
	billingSubscription,
} from "@chevrotain/core/billing/billing.sql";
import type { NodeDatabaseClient } from "@chevrotain/core/drizzle/index";

function serializeSnapshot(value: unknown) {
	return JSON.stringify(value);
}

export function makePolarWebhookHandlers(
	db: NodeDatabaseClient,
): Pick<
	WebhooksOptions,
	| "onPayload"
	| "onCustomerStateChanged"
	| "onOrderCreated"
	| "onOrderPaid"
	| "onOrderRefunded"
	| "onOrderUpdated"
	| "onSubscriptionCreated"
	| "onSubscriptionUpdated"
	| "onSubscriptionActive"
	| "onSubscriptionCanceled"
	| "onSubscriptionRevoked"
	| "onSubscriptionUncanceled"
> {
	async function getKnownUserId(externalId: string | null | undefined) {
		if (!externalId) {
			return null;
		}

		const rows = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, externalId))
			.limit(1);

		return rows[0]?.id ?? null;
	}

	async function upsertCustomerState(state: CustomerState) {
		const userId = await getKnownUserId(state.externalId);

		if (!userId) {
			return;
		}

		const nextValues = {
			userId,
			polarCustomerId: state.id,
			email: state.email,
			name: state.name,
			deletedAt: state.deletedAt,
			activeSubscriptionsCount: state.activeSubscriptions.length,
			hasActiveSubscription: state.activeSubscriptions.length > 0,
			snapshotJson: serializeSnapshot(state),
			remoteCreatedAt: state.createdAt,
			remoteModifiedAt: state.modifiedAt,
			syncedAt: new Date(),
		};

		await db.insert(billingCustomer).values(nextValues).onConflictDoUpdate({
			target: billingCustomer.userId,
			set: nextValues,
		});
	}

	async function upsertSubscription(subscription: Subscription) {
		const userId = await getKnownUserId(subscription.customer.externalId);

		if (!userId) {
			return;
		}

		const nextValues = {
			id: subscription.id,
			userId,
			polarCustomerId: subscription.customerId,
			productId: subscription.productId,
			status: subscription.status,
			amount: subscription.amount,
			currency: subscription.currency,
			recurringInterval: subscription.recurringInterval,
			currentPeriodStart: subscription.currentPeriodStart,
			currentPeriodEnd: subscription.currentPeriodEnd,
			trialStart: subscription.trialStart,
			trialEnd: subscription.trialEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			canceledAt: subscription.canceledAt,
			startedAt: subscription.startedAt,
			endsAt: subscription.endsAt,
			endedAt: subscription.endedAt,
			snapshotJson: serializeSnapshot(subscription),
			remoteCreatedAt: subscription.createdAt,
			remoteModifiedAt: subscription.modifiedAt,
			syncedAt: new Date(),
		};

		await db.insert(billingSubscription).values(nextValues).onConflictDoUpdate({
			target: billingSubscription.id,
			set: nextValues,
		});
	}

	async function upsertOrder(order: Order) {
		const userId = await getKnownUserId(order.customer.externalId);
		const nextValues = {
			id: order.id,
			userId,
			polarCustomerId: order.customerId,
			productId: order.productId,
			subscriptionId: order.subscriptionId,
			status: order.status,
			billingReason: order.billingReason,
			paid: order.paid,
			currency: order.currency,
			subtotalAmount: order.subtotalAmount,
			discountAmount: order.discountAmount,
			netAmount: order.netAmount,
			taxAmount: order.taxAmount,
			totalAmount: order.totalAmount,
			refundedAmount: order.refundedAmount,
			dueAmount: order.dueAmount,
			snapshotJson: serializeSnapshot(order),
			remoteCreatedAt: order.createdAt,
			remoteModifiedAt: order.modifiedAt,
			syncedAt: new Date(),
		};

		await db.insert(billingOrder).values(nextValues).onConflictDoUpdate({
			target: billingOrder.id,
			set: nextValues,
		});
	}

	return {
		onPayload: async (payload) => {
			console.info(`[polar.webhook] ${payload.type}`);
		},
		onCustomerStateChanged: async (payload) => {
			await upsertCustomerState(payload.data);
		},
		onOrderCreated: async (payload) => {
			await upsertOrder(payload.data);
		},
		onOrderPaid: async (payload) => {
			await upsertOrder(payload.data);
		},
		onOrderRefunded: async (payload) => {
			await upsertOrder(payload.data);
		},
		onOrderUpdated: async (payload) => {
			await upsertOrder(payload.data);
		},
		onSubscriptionCreated: async (payload) => {
			await upsertSubscription(payload.data);
		},
		onSubscriptionUpdated: async (payload) => {
			await upsertSubscription(payload.data);
		},
		onSubscriptionActive: async (payload) => {
			await upsertSubscription(payload.data);
		},
		onSubscriptionCanceled: async (payload) => {
			await upsertSubscription(payload.data);
		},
		onSubscriptionRevoked: async (payload) => {
			await upsertSubscription(payload.data);
		},
		onSubscriptionUncanceled: async (payload) => {
			await upsertSubscription(payload.data);
		},
	};
}
