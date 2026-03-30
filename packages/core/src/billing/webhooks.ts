import type { WebhooksOptions } from "@polar-sh/better-auth";
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
	BillingCustomerSnapshotRow,
	BillingOrderSnapshotRow,
	BillingSubscriptionSnapshotRow,
} from "@chevrotain/core/billing/schema";
import type { DatabaseExecutor } from "@chevrotain/core/drizzle/index";
import { BillingError } from "@chevrotain/core/errors";

function serializeSnapshot(value: unknown) {
	return JSON.stringify(value);
}

function decodeBillingCustomerSnapshot(values: unknown): BillingCustomerSnapshotRow {
	try {
		return Schema.decodeUnknownSync(BillingCustomerSnapshotRow)(values);
	} catch (error) {
		throw new BillingError({
			message: `Invalid billing customer snapshot payload: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

function decodeBillingSubscriptionSnapshot(values: unknown): BillingSubscriptionSnapshotRow {
	try {
		return Schema.decodeUnknownSync(BillingSubscriptionSnapshotRow)(values);
	} catch (error) {
		throw new BillingError({
			message: `Invalid billing subscription snapshot payload: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

function decodeBillingOrderSnapshot(values: unknown): BillingOrderSnapshotRow {
	try {
		return Schema.decodeUnknownSync(BillingOrderSnapshotRow)(values);
	} catch (error) {
		throw new BillingError({
			message: `Invalid billing order snapshot payload: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}

function hasActiveSubscriptionStatus(status: string) {
	switch (status) {
		case "trialing":
		case "active":
		case "past_due":
		case "unpaid":
			return true;
		default:
			return false;
	}
}

function buildBillingCustomerSnapshot(values: {
	userId: string;
	polarCustomerId: string;
	email: string;
	name: string | null;
	deletedAt: Date | null;
	activeSubscriptionsCount: number;
	hasActiveSubscription: boolean;
	snapshot: unknown;
	remoteCreatedAt: Date;
	remoteModifiedAt: Date | null;
}): BillingCustomerSnapshotRow {
	return decodeBillingCustomerSnapshot({
		userId: values.userId,
		polarCustomerId: values.polarCustomerId,
		email: values.email,
		name: values.name,
		deletedAt: values.deletedAt,
		activeSubscriptionsCount: values.activeSubscriptionsCount,
		hasActiveSubscription: values.hasActiveSubscription,
		snapshotJson: serializeSnapshot(values.snapshot),
		remoteCreatedAt: values.remoteCreatedAt,
		remoteModifiedAt: values.remoteModifiedAt,
		syncedAt: new Date(),
	});
}

function buildBillingSubscriptionSnapshot(values: {
	id: string;
	userId: string;
	polarCustomerId: string;
	productId: string;
	status: string;
	amount: number;
	currency: string;
	recurringInterval: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	trialStart: Date | null;
	trialEnd: Date | null;
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
	startedAt: Date | null;
	endsAt: Date | null;
	endedAt: Date | null;
	snapshot: unknown;
	remoteCreatedAt: Date;
	remoteModifiedAt: Date | null;
}): BillingSubscriptionSnapshotRow {
	return decodeBillingSubscriptionSnapshot({
		id: values.id,
		userId: values.userId,
		polarCustomerId: values.polarCustomerId,
		productId: values.productId,
		status: values.status,
		amount: values.amount,
		currency: values.currency,
		recurringInterval: values.recurringInterval,
		currentPeriodStart: values.currentPeriodStart,
		currentPeriodEnd: values.currentPeriodEnd,
		trialStart: values.trialStart,
		trialEnd: values.trialEnd,
		cancelAtPeriodEnd: values.cancelAtPeriodEnd,
		canceledAt: values.canceledAt,
		startedAt: values.startedAt,
		endsAt: values.endsAt,
		endedAt: values.endedAt,
		snapshotJson: serializeSnapshot(values.snapshot),
		remoteCreatedAt: values.remoteCreatedAt,
		remoteModifiedAt: values.remoteModifiedAt,
		syncedAt: new Date(),
	});
}

function buildBillingOrderSnapshot(values: {
	id: string;
	userId: string | null;
	polarCustomerId: string;
	productId: string | null;
	subscriptionId: string | null;
	status: string;
	billingReason: string;
	paid: boolean;
	currency: string;
	subtotalAmount: number;
	discountAmount: number;
	netAmount: number;
	taxAmount: number;
	totalAmount: number;
	refundedAmount: number;
	dueAmount: number;
	snapshot: unknown;
	remoteCreatedAt: Date;
	remoteModifiedAt: Date | null;
}): BillingOrderSnapshotRow {
	return decodeBillingOrderSnapshot({
		id: values.id,
		userId: values.userId,
		polarCustomerId: values.polarCustomerId,
		productId: values.productId,
		subscriptionId: values.subscriptionId,
		status: values.status,
		billingReason: values.billingReason,
		paid: values.paid,
		currency: values.currency,
		subtotalAmount: values.subtotalAmount,
		discountAmount: values.discountAmount,
		netAmount: values.netAmount,
		taxAmount: values.taxAmount,
		totalAmount: values.totalAmount,
		refundedAmount: values.refundedAmount,
		dueAmount: values.dueAmount,
		snapshotJson: serializeSnapshot(values.snapshot),
		remoteCreatedAt: values.remoteCreatedAt,
		remoteModifiedAt: values.remoteModifiedAt,
		syncedAt: new Date(),
	});
}

async function ensureBillingCustomerSnapshot(
	db: DatabaseExecutor,
	values: Parameters<typeof buildBillingCustomerSnapshot>[0],
) {
	const persistedValues = buildBillingCustomerSnapshot(values);
	await db.insert(billingCustomer).values(persistedValues).onConflictDoNothing();
}

async function upsertBillingCustomerSnapshot(
	db: DatabaseExecutor,
	values: Parameters<typeof buildBillingCustomerSnapshot>[0],
) {
	const persistedValues = buildBillingCustomerSnapshot(values);
	await db.insert(billingCustomer).values(persistedValues).onConflictDoUpdate({
		target: billingCustomer.userId,
		set: persistedValues,
	});
}

async function upsertBillingSubscriptionSnapshot(
	db: DatabaseExecutor,
	values: Parameters<typeof buildBillingSubscriptionSnapshot>[0],
) {
	const persistedValues = buildBillingSubscriptionSnapshot(values);
	await db.insert(billingSubscription).values(persistedValues).onConflictDoUpdate({
		target: billingSubscription.id,
		set: persistedValues,
	});
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

export function makePolarWebhookHandlers(
	db: DatabaseExecutor,
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
		const userId = assertPolarCustomer(
			"customer state",
			state.externalId,
			await getKnownUserId(state.externalId),
		);

		await upsertBillingCustomerSnapshot(db, {
			userId,
			polarCustomerId: state.id,
			email: state.email,
			name: state.name,
			deletedAt: state.deletedAt,
			activeSubscriptionsCount: state.activeSubscriptions.length,
			hasActiveSubscription: state.activeSubscriptions.length > 0,
			snapshot: state,
			remoteCreatedAt: state.createdAt,
			remoteModifiedAt: state.modifiedAt,
		});
	}

	async function upsertSubscription(subscription: Subscription) {
		const userId = assertPolarCustomer(
			"subscription",
			subscription.customer.externalId,
			await getKnownUserId(subscription.customer.externalId),
		);

		await ensureBillingCustomerSnapshot(db, {
			userId,
			polarCustomerId: subscription.customerId,
			email: subscription.customer.email,
			name: subscription.customer.name,
			deletedAt: subscription.customer.deletedAt,
			activeSubscriptionsCount: hasActiveSubscriptionStatus(subscription.status) ? 1 : 0,
			hasActiveSubscription: hasActiveSubscriptionStatus(subscription.status),
			snapshot: subscription.customer,
			remoteCreatedAt: subscription.customer.createdAt,
			remoteModifiedAt: subscription.customer.modifiedAt,
		});

		await upsertBillingSubscriptionSnapshot(db, {
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
			snapshot: subscription,
			remoteCreatedAt: subscription.createdAt,
			remoteModifiedAt: subscription.modifiedAt,
		});
	}

	async function upsertOrder(order: Order) {
		const userId = await getKnownUserId(order.customer.externalId);

		if (userId) {
			await ensureBillingCustomerSnapshot(db, {
				userId,
				polarCustomerId: order.customerId,
				email: order.customer.email,
				name: order.customer.name,
				deletedAt: order.customer.deletedAt,
				activeSubscriptionsCount:
					order.subscription && hasActiveSubscriptionStatus(order.subscription.status) ? 1 : 0,
				hasActiveSubscription:
					order.subscription !== null && hasActiveSubscriptionStatus(order.subscription.status),
				snapshot: order.customer,
				remoteCreatedAt: order.customer.createdAt,
				remoteModifiedAt: order.customer.modifiedAt,
			});

			if (order.subscriptionId) {
				const [existingSubscription] = await db
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

					await upsertBillingSubscriptionSnapshot(db, {
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
						snapshot: order.subscription,
						remoteCreatedAt: order.subscription.createdAt,
						remoteModifiedAt: order.subscription.modifiedAt,
					});
				}
			}
		}

		const persistedValues = buildBillingOrderSnapshot({
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
			snapshot: order,
			remoteCreatedAt: order.createdAt,
			remoteModifiedAt: order.modifiedAt,
		});

		await db.insert(billingOrder).values(persistedValues).onConflictDoUpdate({
			target: billingOrder.id,
			set: persistedValues,
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
