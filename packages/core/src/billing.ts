import { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";
import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";

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
import { Config } from "@chevrotain/core/config";
import { Database, type DatabaseExecutor } from "@chevrotain/core/drizzle/index";
import { makeRunPromise } from "@chevrotain/core/effect/run-service";
import { BillingError } from "@chevrotain/core/errors";

export namespace Billing {
	export const assertCustomer = Effect.fn("Billing.assertCustomer")(function* (
		resource: string,
		externalId: string | null | undefined,
		userId: string | null,
	) {
		if (userId) return userId;

		if (!externalId) {
			return yield* new BillingError({
				message: `Polar ${resource} webhook payload is missing an external user id`,
			});
		}

		return yield* new BillingError({
			message: `Polar ${resource} webhook references unknown local user: ${externalId}`,
		});
	});

	export interface Interface {
		readonly upsertCustomerState: (state: CustomerState) => Effect.Effect<void, BillingError>;
		readonly upsertSubscription: (subscription: Subscription) => Effect.Effect<void, BillingError>;
		readonly upsertOrder: (order: Order) => Effect.Effect<void, BillingError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Billing") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const config = yield* Config;
			const { db } = yield* Database.Service;
			const polarClient = new Polar({
				accessToken: Redacted.value(config.billing.accessToken),
				server: config.billing.server,
			});

			async function syncCustomerState(
				tx: DatabaseExecutor,
				values: { userId: string; state: CustomerState },
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

				await tx.insert(billingCustomer).values(customerSnapshot).onConflictDoUpdate({
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

					await tx.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
						target: billingSubscription.id,
						set: subscriptionSnapshot,
					});
				}
			}

			const loadCustomerState = Effect.fn("Billing.loadCustomerState")(function* (
				customerId: string,
			) {
				return yield* Effect.tryPromise({
					try: () => polarClient.customers.getState({ id: customerId }),
					catch: (error) =>
						new BillingError({
							message: `Unable to load Polar customer state for ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const getKnownUserId = Effect.fn("Billing.getKnownUserId")(function* (
				externalId: string | null | undefined,
			) {
				if (!externalId) return null;

				const rows = yield* Effect.tryPromise({
					try: () => db.select({ id: user.id }).from(user).where(eq(user.id, externalId)).limit(1),
					catch: (error) =>
						new BillingError({
							message: `Failed to look up user ${externalId}: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				return rows[0]?.id ?? null;
			});

			const upsertCustomerState = Effect.fn("Billing.upsertCustomerState")(function* (
				state: CustomerState,
			) {
				const userId = yield* assertCustomer(
					"customer state",
					state.externalId,
					yield* getKnownUserId(state.externalId),
				);

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							await syncCustomerState(tx, { userId, state });
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to upsert customer state: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const upsertSubscription = Effect.fn("Billing.upsertSubscription")(function* (
				subscription: Subscription,
			) {
				const userId = yield* assertCustomer(
					"subscription",
					subscription.customer.externalId,
					yield* getKnownUserId(subscription.customer.externalId),
				);
				const customerState = yield* loadCustomerState(subscription.customerId);

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							await syncCustomerState(tx, {
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
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to upsert subscription: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const upsertOrder = Effect.fn("Billing.upsertOrder")(function* (order: Order) {
				const userId = yield* getKnownUserId(order.customer.externalId);
				const customerState = userId ? yield* loadCustomerState(order.customerId) : null;

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							if (userId && customerState) {
								await syncCustomerState(tx, {
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

										const subscriptionSnapshot = Schema.decodeUnknownSync(
											BillingSubscriptionSnapshot,
										)({
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

										await tx
											.insert(billingSubscription)
											.values(subscriptionSnapshot)
											.onConflictDoUpdate({
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
						}),
					catch: (error) => {
						if (error instanceof BillingError) return error;
						return new BillingError({
							message: `Failed to upsert order: ${error instanceof Error ? error.message : String(error)}`,
						});
					},
				});
			});

			return Service.of({
				upsertCustomerState,
				upsertSubscription,
				upsertOrder,
			});
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer));

	const runPromise = makeRunPromise(Service, defaultLayer);

	export async function upsertCustomerState(state: CustomerState) {
		return runPromise((service) => service.upsertCustomerState(state));
	}

	export async function upsertSubscription(subscription: Subscription) {
		return runPromise((service) => service.upsertSubscription(subscription));
	}

	export async function upsertOrder(order: Order) {
		return runPromise((service) => service.upsertOrder(order));
	}
}
