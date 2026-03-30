import type { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";
import { Schema } from "effect";

import { user } from "@chevrotain/core/auth/auth.sql";
import {
	billingCustomer,
	billingOrder,
	billingSubscription,
} from "@chevrotain/core/billing/billing.sql";
import {
	BillingCustomerSnapshot,
	BillingOrderSnapshot,
	BillingSubscriptionSnapshot,
} from "@chevrotain/core/billing/schema";
import type { DatabaseExecutor } from "@chevrotain/core/drizzle/index";
import { BillingError } from "@chevrotain/core/errors";

type BillingPolarClient = Pick<Polar, "customers">;

async function syncBillingCustomerState(
	db: DatabaseExecutor,
	values: {
		userId: string;
		state: CustomerState;
	},
) {
	const customerSnapshot = Schema.decodeUnknownSync(BillingCustomerSnapshot)({
		userId: values.userId,
		polarCustomerId: values.state.id,
		email: values.state.email,
		name: values.state.name,
		deletedAt: values.state.deletedAt,
		activeSubscriptionsCount: values.state.activeSubscriptions.length,
		hasActiveSubscription: values.state.activeSubscriptions.length > 0,
		snapshotJson: JSON.stringify(values.state),
		remoteCreatedAt: values.state.createdAt,
		remoteModifiedAt: values.state.modifiedAt,
		syncedAt: new Date(),
	});

	await db.insert(billingCustomer).values(customerSnapshot).onConflictDoUpdate({
		target: billingCustomer.userId,
		set: customerSnapshot,
	});

	for (const sub of values.state.activeSubscriptions) {
		const subscriptionSnapshot = Schema.decodeUnknownSync(BillingSubscriptionSnapshot)({
			id: sub.id,
			userId: values.userId,
			polarCustomerId: values.state.id,
			productId: sub.productId,
			status: sub.status,
			amount: sub.amount,
			currency: sub.currency,
			recurringInterval: sub.recurringInterval,
			currentPeriodStart: sub.currentPeriodStart,
			currentPeriodEnd: sub.currentPeriodEnd,
			trialStart: sub.trialStart,
			trialEnd: sub.trialEnd,
			cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
			canceledAt: sub.canceledAt,
			startedAt: sub.startedAt,
			endsAt: sub.endsAt,
			endedAt: null,
			snapshotJson: JSON.stringify(sub),
			remoteCreatedAt: sub.createdAt,
			remoteModifiedAt: sub.modifiedAt,
			syncedAt: new Date(),
		});

		await db.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
			target: billingSubscription.id,
			set: subscriptionSnapshot,
		});
	}
}

async function loadPolarCustomerState(
	polarClient: BillingPolarClient,
	customerId: string,
): Promise<CustomerState> {
	try {
		return await polarClient.customers.getState({ id: customerId });
	} catch (error) {
		throw new BillingError({
			message: `Unable to load Polar customer state for ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

export function assertPolarCustomer(
	resource: string,
	externalId: string | null | undefined,
	userId: string | null,
) {
	if (userId) {
		return userId;
	}

	if (!externalId) {
		throw new BillingError({
			message: `Polar ${resource} webhook payload is missing an external user id`,
		});
	}

	throw new BillingError({
		message: `Polar ${resource} webhook references unknown local user: ${externalId}`,
	});
}

async function getKnownUserId(db: DatabaseExecutor, externalId: string | null | undefined) {
	if (!externalId) {
		return null;
	}

	const rows = await db.select({ id: user.id }).from(user).where(eq(user.id, externalId)).limit(1);

	return rows[0]?.id ?? null;
}

export async function upsertPolarCustomerState(db: DatabaseExecutor, state: CustomerState) {
	const userId = assertPolarCustomer(
		"customer state",
		state.externalId,
		await getKnownUserId(db, state.externalId),
	);

	await db.transaction(async (tx) => {
		await syncBillingCustomerState(tx, {
			userId,
			state,
		});
	});
}

export async function upsertPolarSubscription(
	db: DatabaseExecutor,
	polarClient: BillingPolarClient,
	subscription: Subscription,
) {
	const userId = assertPolarCustomer(
		"subscription",
		subscription.customer.externalId,
		await getKnownUserId(db, subscription.customer.externalId),
	);
	const customerState = await loadPolarCustomerState(polarClient, subscription.customerId);

	await db.transaction(async (tx) => {
		await syncBillingCustomerState(tx, {
			userId,
			state: customerState,
		});

		const subscriptionSnapshot = Schema.decodeUnknownSync(BillingSubscriptionSnapshot)({
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
			snapshotJson: JSON.stringify(subscription),
			remoteCreatedAt: subscription.createdAt,
			remoteModifiedAt: subscription.modifiedAt,
			syncedAt: new Date(),
		});

		await tx.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
			target: billingSubscription.id,
			set: subscriptionSnapshot,
		});
	});
}

export async function upsertPolarOrder(
	db: DatabaseExecutor,
	polarClient: BillingPolarClient,
	order: Order,
) {
	const userId = await getKnownUserId(db, order.customer.externalId);
	const customerState = userId ? await loadPolarCustomerState(polarClient, order.customerId) : null;

	await db.transaction(async (tx) => {
		if (userId && customerState) {
			await syncBillingCustomerState(tx, {
				userId,
				state: customerState,
			});

			if (order.subscriptionId) {
				const [existingSubscription] = await tx
					.select({
						id: billingSubscription.id,
						polarCustomerId: billingSubscription.polarCustomerId,
						userId: billingSubscription.userId,
					})
					.from(billingSubscription)
					.where(eq(billingSubscription.id, order.subscriptionId))
					.limit(1);

				if (existingSubscription) {
					if (
						existingSubscription.userId !== userId ||
						existingSubscription.polarCustomerId !== order.customerId
					) {
						throw new BillingError({
							message: `Polar order ${order.id} references subscription ${order.subscriptionId} with mismatched local ownership`,
						});
					}
				} else {
					if (!order.subscription) {
						throw new BillingError({
							message: `Polar order ${order.id} references subscription ${order.subscriptionId} before its snapshot is available`,
						});
					}

					if (order.subscription.id !== order.subscriptionId) {
						throw new BillingError({
							message: `Polar order ${order.id} embeds subscription ${order.subscription.id} but references ${order.subscriptionId}`,
						});
					}

					if (order.subscription.customerId !== order.customerId) {
						throw new BillingError({
							message: `Polar order ${order.id} subscription customer ${order.subscription.customerId} does not match order customer ${order.customerId}`,
						});
					}

					const subscriptionSnapshot = Schema.decodeUnknownSync(BillingSubscriptionSnapshot)({
						id: order.subscription.id,
						userId,
						polarCustomerId: order.subscription.customerId,
						productId: order.subscription.productId,
						status: order.subscription.status,
						amount: order.subscription.amount,
						currency: order.subscription.currency,
						recurringInterval: order.subscription.recurringInterval,
						currentPeriodStart: order.subscription.currentPeriodStart,
						currentPeriodEnd: order.subscription.currentPeriodEnd,
						trialStart: order.subscription.trialStart,
						trialEnd: order.subscription.trialEnd,
						cancelAtPeriodEnd: order.subscription.cancelAtPeriodEnd,
						canceledAt: order.subscription.canceledAt,
						startedAt: order.subscription.startedAt,
						endsAt: order.subscription.endsAt,
						endedAt: order.subscription.endedAt,
						snapshotJson: JSON.stringify(order.subscription),
						remoteCreatedAt: order.subscription.createdAt,
						remoteModifiedAt: order.subscription.modifiedAt,
						syncedAt: new Date(),
					});

					await tx.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
						target: billingSubscription.id,
						set: subscriptionSnapshot,
					});
				}
			}
		}

		const orderSnapshot = Schema.decodeUnknownSync(BillingOrderSnapshot)({
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
			snapshotJson: JSON.stringify(order),
			remoteCreatedAt: order.createdAt,
			remoteModifiedAt: order.modifiedAt,
			syncedAt: new Date(),
		});

		await tx.insert(billingOrder).values(orderSnapshot).onConflictDoUpdate({
			target: billingOrder.id,
			set: orderSnapshot,
		});
	});
}
