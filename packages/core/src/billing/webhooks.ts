import type { WebhooksOptions } from "@polar-sh/better-auth";
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
	BillingCustomerSnapshotRow,
	BillingOrderSnapshotRow,
	BillingSubscriptionSnapshotRow,
} from "@chevrotain/core/billing/schema";
import type { DatabaseExecutor } from "@chevrotain/core/drizzle/index";
import { BillingError } from "@chevrotain/core/errors";

type BillingPolarClient = Pick<Polar, "customers">;

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

export function buildBillingCustomerSnapshotFromState(values: {
	userId: string;
	state: CustomerState;
}): BillingCustomerSnapshotRow {
	return buildBillingCustomerSnapshot({
		userId: values.userId,
		polarCustomerId: values.state.id,
		email: values.state.email,
		name: values.state.name,
		deletedAt: values.state.deletedAt,
		activeSubscriptionsCount: values.state.activeSubscriptions.length,
		hasActiveSubscription: values.state.activeSubscriptions.length > 0,
		snapshot: values.state,
		remoteCreatedAt: values.state.createdAt,
		remoteModifiedAt: values.state.modifiedAt,
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

export function buildBillingSubscriptionSnapshotFromState(values: {
	userId: string;
	polarCustomerId: string;
	state: CustomerState["activeSubscriptions"][number];
}): BillingSubscriptionSnapshotRow {
	return buildBillingSubscriptionSnapshot({
		id: values.state.id,
		userId: values.userId,
		polarCustomerId: values.polarCustomerId,
		productId: values.state.productId,
		status: values.state.status,
		amount: values.state.amount,
		currency: values.state.currency,
		recurringInterval: values.state.recurringInterval,
		currentPeriodStart: values.state.currentPeriodStart,
		currentPeriodEnd: values.state.currentPeriodEnd,
		trialStart: values.state.trialStart,
		trialEnd: values.state.trialEnd,
		cancelAtPeriodEnd: values.state.cancelAtPeriodEnd,
		canceledAt: values.state.canceledAt,
		startedAt: values.state.startedAt,
		endsAt: values.state.endsAt,
		endedAt: null,
		snapshot: values.state,
		remoteCreatedAt: values.state.createdAt,
		remoteModifiedAt: values.state.modifiedAt,
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

async function syncBillingCustomerState(
	db: DatabaseExecutor,
	values: {
		userId: string;
		state: CustomerState;
	},
) {
	const customerSnapshot = buildBillingCustomerSnapshotFromState(values);
	await upsertBillingCustomerSnapshot(db, {
		userId: customerSnapshot.userId,
		polarCustomerId: customerSnapshot.polarCustomerId,
		email: customerSnapshot.email,
		name: customerSnapshot.name,
		deletedAt: customerSnapshot.deletedAt,
		activeSubscriptionsCount: customerSnapshot.activeSubscriptionsCount,
		hasActiveSubscription: customerSnapshot.hasActiveSubscription,
		snapshot: values.state,
		remoteCreatedAt: customerSnapshot.remoteCreatedAt,
		remoteModifiedAt: customerSnapshot.remoteModifiedAt,
	});

	for (const subscriptionState of values.state.activeSubscriptions) {
		const subscriptionSnapshot = buildBillingSubscriptionSnapshotFromState({
			userId: values.userId,
			polarCustomerId: values.state.id,
			state: subscriptionState,
		});

		await upsertBillingSubscriptionSnapshot(db, {
			id: subscriptionSnapshot.id,
			userId: subscriptionSnapshot.userId,
			polarCustomerId: subscriptionSnapshot.polarCustomerId,
			productId: subscriptionSnapshot.productId,
			status: subscriptionSnapshot.status,
			amount: subscriptionSnapshot.amount,
			currency: subscriptionSnapshot.currency,
			recurringInterval: subscriptionSnapshot.recurringInterval,
			currentPeriodStart: subscriptionSnapshot.currentPeriodStart,
			currentPeriodEnd: subscriptionSnapshot.currentPeriodEnd,
			trialStart: subscriptionSnapshot.trialStart,
			trialEnd: subscriptionSnapshot.trialEnd,
			cancelAtPeriodEnd: subscriptionSnapshot.cancelAtPeriodEnd,
			canceledAt: subscriptionSnapshot.canceledAt,
			startedAt: subscriptionSnapshot.startedAt,
			endsAt: subscriptionSnapshot.endsAt,
			endedAt: subscriptionSnapshot.endedAt,
			snapshot: subscriptionState,
			remoteCreatedAt: subscriptionSnapshot.remoteCreatedAt,
			remoteModifiedAt: subscriptionSnapshot.remoteModifiedAt,
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
	polarClient: BillingPolarClient,
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

		await db.transaction(async (tx) => {
			await syncBillingCustomerState(tx, {
				userId,
				state,
			});
		});
	}

	async function upsertSubscription(subscription: Subscription) {
		const userId = assertPolarCustomer(
			"subscription",
			subscription.customer.externalId,
			await getKnownUserId(subscription.customer.externalId),
		);
		const customerState = await loadPolarCustomerState(polarClient, subscription.customerId);

		await db.transaction(async (tx) => {
			await syncBillingCustomerState(tx, {
				userId,
				state: customerState,
			});

			await upsertBillingSubscriptionSnapshot(tx, {
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
		});
	}

	async function upsertOrder(order: Order) {
		const userId = await getKnownUserId(order.customer.externalId);
		const customerState = userId
			? await loadPolarCustomerState(polarClient, order.customerId)
			: null;

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

						await upsertBillingSubscriptionSnapshot(tx, {
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

			await tx.insert(billingOrder).values(persistedValues).onConflictDoUpdate({
				target: billingOrder.id,
				set: persistedValues,
			});
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
