import { polar, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";
import type {
	EffectDrizzleQueryError,
	EffectTransactionRollbackError,
} from "drizzle-orm/effect-core/errors";
import { Cause, Effect, Layer, Schema, Context } from "effect";
import { Resource } from "sst";

import { organizationTable } from "@leuchtturm/core/auth/auth.sql";
import {
	billingCustomerTable,
	billingOrderTable,
	billingSubscriptionTable,
} from "@leuchtturm/core/billing/billing.sql";
import {
	BillingError,
	BillingInvalidSnapshotError,
	BillingMissingExternalOrganizationError,
	BillingMissingSubscriptionSnapshotError,
	BillingOrganizationLookupError,
	BillingPersistenceError,
	BillingPolarRequestError,
	BillingSubscriptionOwnershipMismatchError,
	BillingSubscriptionReferenceMismatchError,
	BillingUnknownOrganizationError,
	type BillingErrorType,
} from "@leuchtturm/core/billing/errors";
import { POLAR_PRO_PRODUCT_ID } from "@leuchtturm/core/billing/products";
import {
	BillingCustomerSnapshot,
	BillingOrderSnapshot,
	BillingSubscriptionSnapshot,
} from "@leuchtturm/core/billing/schema";
import { Database } from "@leuchtturm/core/drizzle";

type TransactionEffect<A> = Effect.Effect<
	A,
	EffectDrizzleQueryError | EffectTransactionRollbackError | BillingErrorType,
	never
>;

export namespace Billing {
	export interface Interface {
		readonly authPlugin: ReturnType<typeof polar>;
		readonly createCustomer: (params: {
			organizationId: string;
			name: string;
			slug: string;
			ownerEmail: string;
			ownerName: string;
		}) => Effect.Effect<void, typeof BillingError.Type>;
		readonly updateCustomer: (params: {
			organizationId: string;
			name: string;
			slug: string;
		}) => Effect.Effect<void, typeof BillingError.Type>;
		readonly getCustomerState: (
			organizationId: string,
		) => Effect.Effect<CustomerState, typeof BillingError.Type>;
		readonly createCheckoutUrl: (params: {
			organizationId: string;
			successUrl: string;
			returnUrl: string;
		}) => Effect.Effect<string, typeof BillingError.Type>;
		readonly createPortalUrl: (params: {
			organizationId: string;
			returnUrl: string;
		}) => Effect.Effect<string, typeof BillingError.Type>;
		readonly upsertCustomerState: (
			state: CustomerState,
		) => Effect.Effect<void, typeof BillingError.Type>;
		readonly upsertSubscription: (
			subscription: Subscription,
		) => Effect.Effect<void, typeof BillingError.Type>;
		readonly upsertOrder: (order: Order) => Effect.Effect<void, typeof BillingError.Type>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Billing") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { database } = yield* Database.Service;
			const polarClient = new Polar({
				accessToken: Resource.PolarAccessToken.value,
				server: "sandbox",
			});

			const buildSubscriptionSnapshot = Effect.fn("Billing.buildSubscriptionSnapshot")(function* (
				values: Record<string, unknown>,
			) {
				return yield* Schema.decodeUnknownEffect(BillingSubscriptionSnapshot)({
					...values,
					syncedAt: new Date(),
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingInvalidSnapshotError({
									resource: "subscription",
								}),
							);
						}),
					),
				);
			});

			const syncCustomerState = (
				tx: Database.Executor,
				values: { organizationId: string; state: CustomerState },
			): TransactionEffect<void> =>
				Effect.gen(function* () {
					yield* Schema.decodeUnknownEffect(BillingCustomerSnapshot)({
						organizationId: values.organizationId,
						polarCustomerId: values.state.id,
						email: values.state.email ?? null,
						name: values.state.name,
						deletedAt: values.state.deletedAt,
						activeSubscriptionsCount: values.state.activeSubscriptions.length,
						hasActiveSubscription: values.state.activeSubscriptions.length > 0,
						snapshotJson: JSON.stringify(values.state),
						remoteCreatedAt: values.state.createdAt,
						remoteModifiedAt: values.state.modifiedAt,
						syncedAt: new Date(),
					}).pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
								return yield* Effect.fail(
									new BillingInvalidSnapshotError({
										resource: "customer",
									}),
								);
							}),
						),
						Effect.flatMap((customerSnapshot) =>
							tx.insert(billingCustomerTable).values(customerSnapshot).onConflictDoUpdate({
								target: billingCustomerTable.organizationId,
								set: customerSnapshot,
							}),
						),
					);

					for (const subscription of values.state.activeSubscriptions) {
						const subscriptionSnapshot = yield* buildSubscriptionSnapshot({
							id: subscription.id,
							organizationId: values.organizationId,
							polarCustomerId: values.state.id,
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
							endedAt: null,
							snapshotJson: JSON.stringify(subscription),
							remoteCreatedAt: subscription.createdAt,
							remoteModifiedAt: subscription.modifiedAt,
						});

						yield* tx
							.insert(billingSubscriptionTable)
							.values(subscriptionSnapshot)
							.onConflictDoUpdate({
								target: billingSubscriptionTable.id,
								set: subscriptionSnapshot,
							});
					}
				}) as TransactionEffect<void>;

			const assertCustomer = Effect.fn("Billing.assertCustomer")(function* (
				resource: string,
				externalId: string | null | undefined,
				organizationId: string | null,
			) {
				if (organizationId) return organizationId;

				if (!externalId) {
					return yield* new BillingMissingExternalOrganizationError({
						resource,
					});
				}

				return yield* new BillingUnknownOrganizationError({
					resource,
					externalId,
				});
			});

			const loadCustomerState = Effect.fn("Billing.loadCustomerState")(function* (
				customerId: string,
			) {
				return yield* Effect.tryPromise({
					try: () => polarClient.customers.getState({ id: customerId }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Unable to load Polar customer state for ${customerId}`,
								}),
							);
						}),
					),
				);
			});

			const loadCustomerStateExternal = Effect.fn("Billing.loadCustomerStateExternal")(function* (
				organizationId: string,
			) {
				return yield* Effect.tryPromise({
					try: () => polarClient.customers.getStateExternal({ externalId: organizationId }),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Unable to load Polar customer state for organization ${organizationId}`,
								}),
							);
						}),
					),
				);
			});

			const getKnownOrganizationId = Effect.fn("Billing.getKnownOrganizationId")(function* (
				externalId: string | null | undefined,
			) {
				if (!externalId) return null;

				const rows = yield* database
					.select({ id: organizationTable.id })
					.from(organizationTable)
					.where(eq(organizationTable.id, externalId))
					.limit(1)
					.pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
								return yield* Effect.fail(
									new BillingOrganizationLookupError({
										externalId,
									}),
								);
							}),
						),
					);

				return rows[0]?.id ?? null;
			});

			const upsertCustomerState = Effect.fn("Billing.upsertCustomerState")(function* (
				state: CustomerState,
			) {
				const organizationId = yield* assertCustomer(
					"customer state",
					state.externalId,
					yield* getKnownOrganizationId(state.externalId),
				);

				yield* database
					.transaction((tx) => syncCustomerState(tx, { organizationId, state }))
					.pipe(
						Effect.catchTag("BillingInvalidSnapshotError", (error) => Effect.fail(error)),
						Effect.catch(() =>
							Effect.fail(
								new BillingPersistenceError({ operation: "Failed to upsert customer state" }),
							),
						),
					);
			});

			const createCustomer = Effect.fn("Billing.createCustomer")(function* (params: {
				organizationId: string;
				name: string;
				slug: string;
				ownerEmail: string;
				ownerName: string;
			}) {
				yield* Effect.tryPromise({
					try: () =>
						polarClient.customers.create({
							type: "team",
							externalId: params.organizationId,
							name: params.name,
							metadata: { slug: params.slug },
							owner: {
								email: params.ownerEmail,
								name: params.ownerName,
							},
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Failed to create billing customer for organization ${params.organizationId}`,
								}),
							);
						}),
					),
				);

				const state = yield* loadCustomerStateExternal(params.organizationId);
				yield* upsertCustomerState(state);
			});

			const updateCustomer = Effect.fn("Billing.updateCustomer")(function* (params: {
				organizationId: string;
				name: string;
				slug: string;
			}) {
				yield* Effect.tryPromise({
					try: () =>
						polarClient.customers.updateExternal({
							externalId: params.organizationId,
							customerUpdateExternalID: {
								name: params.name,
								metadata: { slug: params.slug },
							},
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Failed to update billing customer for organization ${params.organizationId}`,
								}),
							);
						}),
					),
				);

				const state = yield* loadCustomerStateExternal(params.organizationId);
				yield* upsertCustomerState(state);
			});

			const getCustomerState = Effect.fn("Billing.getCustomerState")(function* (
				organizationId: string,
			) {
				return yield* loadCustomerStateExternal(organizationId);
			});

			const createCheckoutUrl = Effect.fn("Billing.createCheckoutUrl")(function* (params: {
				organizationId: string;
				successUrl: string;
				returnUrl: string;
			}) {
				const checkout = yield* Effect.tryPromise({
					try: () =>
						polarClient.checkouts.create({
							externalCustomerId: params.organizationId,
							products: [POLAR_PRO_PRODUCT_ID],
							successUrl: params.successUrl,
							returnUrl: params.returnUrl,
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Failed to create checkout for organization ${params.organizationId}`,
								}),
							);
						}),
					),
				);

				return checkout.url;
			});

			const createPortalUrl = Effect.fn("Billing.createPortalUrl")(function* (params: {
				organizationId: string;
				returnUrl: string;
			}) {
				const customerSession = yield* Effect.tryPromise({
					try: () =>
						polarClient.customerSessions.create({
							externalCustomerId: params.organizationId,
							returnUrl: params.returnUrl,
						}),
					catch: (cause) => cause,
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ "error.original_cause": Cause.pretty(cause) });
							return yield* Effect.fail(
								new BillingPolarRequestError({
									operation: `Failed to create billing portal for organization ${params.organizationId}`,
								}),
							);
						}),
					),
				);

				return customerSession.customerPortalUrl;
			});

			const upsertSubscription = Effect.fn("Billing.upsertSubscription")(function* (
				subscription: Subscription,
			) {
				const organizationId = yield* assertCustomer(
					"subscription",
					subscription.customer.externalId,
					yield* getKnownOrganizationId(subscription.customer.externalId),
				);
				const customerState = yield* loadCustomerState(subscription.customerId);

				yield* database
					.transaction(
						(tx) =>
							Effect.gen(function* () {
								yield* syncCustomerState(tx, {
									organizationId,
									state: customerState,
								});

								const subscriptionSnapshot = yield* buildSubscriptionSnapshot({
									id: subscription.id,
									organizationId,
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
								});

								yield* tx
									.insert(billingSubscriptionTable)
									.values(subscriptionSnapshot)
									.onConflictDoUpdate({
										target: billingSubscriptionTable.id,
										set: subscriptionSnapshot,
									});
							}) as TransactionEffect<void>,
					)
					.pipe(
						Effect.catchTag("BillingInvalidSnapshotError", (error) => Effect.fail(error)),
						Effect.catch(() =>
							Effect.fail(
								new BillingPersistenceError({ operation: "Failed to upsert subscription" }),
							),
						),
					);
			});

			const upsertOrder = Effect.fn("Billing.upsertOrder")(function* (order: Order) {
				const organizationId = yield* getKnownOrganizationId(order.customer.externalId);
				const customerState = organizationId ? yield* loadCustomerState(order.customerId) : null;

				yield* database
					.transaction(
						(tx) =>
							Effect.gen(function* () {
								if (organizationId && customerState) {
									yield* syncCustomerState(tx, {
										organizationId,
										state: customerState,
									});

									if (order.subscriptionId) {
										const [existingSubscription] = yield* tx
											.select({
												id: billingSubscriptionTable.id,
												polarCustomerId: billingSubscriptionTable.polarCustomerId,
												organizationId: billingSubscriptionTable.organizationId,
											})
											.from(billingSubscriptionTable)
											.where(eq(billingSubscriptionTable.id, order.subscriptionId))
											.limit(1);

										if (existingSubscription) {
											if (
												existingSubscription.organizationId !== organizationId ||
												existingSubscription.polarCustomerId !== order.customerId
											) {
												return yield* new BillingSubscriptionOwnershipMismatchError({
													kind: "local",
													orderId: order.id,
													subscriptionId: order.subscriptionId,
												});
											}
										} else {
											if (!order.subscription) {
												return yield* new BillingMissingSubscriptionSnapshotError({
													orderId: order.id,
													subscriptionId: order.subscriptionId,
												});
											}

											if (order.subscription.id !== order.subscriptionId) {
												return yield* new BillingSubscriptionReferenceMismatchError({
													orderId: order.id,
													embeddedSubscriptionId: order.subscription.id,
													referencedSubscriptionId: order.subscriptionId,
												});
											}

											if (order.subscription.customerId !== order.customerId) {
												return yield* new BillingSubscriptionOwnershipMismatchError({
													kind: "snapshot",
													orderId: order.id,
													subscriptionId: order.subscriptionId,
													subscriptionCustomerId: order.subscription.customerId,
													orderCustomerId: order.customerId,
												});
											}

											const subscriptionSnapshot = yield* buildSubscriptionSnapshot({
												id: order.subscription.id,
												organizationId,
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
											});

											yield* tx
												.insert(billingSubscriptionTable)
												.values(subscriptionSnapshot)
												.onConflictDoUpdate({
													target: billingSubscriptionTable.id,
													set: subscriptionSnapshot,
												});
										}
									}
								}

								yield* Schema.decodeUnknownEffect(BillingOrderSnapshot)({
									id: order.id,
									organizationId,
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
								}).pipe(
									Effect.catchCause((cause) =>
										Effect.gen(function* () {
											yield* Effect.annotateCurrentSpan({
												"error.original_cause": Cause.pretty(cause),
											});
											return yield* Effect.fail(
												new BillingInvalidSnapshotError({
													resource: "order",
												}),
											);
										}),
									),
									Effect.flatMap((orderSnapshot) =>
										tx.insert(billingOrderTable).values(orderSnapshot).onConflictDoUpdate({
											target: billingOrderTable.id,
											set: orderSnapshot,
										}),
									),
								);
							}) as TransactionEffect<void>,
					)
					.pipe(
						Effect.catchTags({
							BillingInvalidSnapshotError: (error) => Effect.fail(error),
							BillingMissingSubscriptionSnapshotError: (error) => Effect.fail(error),
							BillingSubscriptionOwnershipMismatchError: (error) => Effect.fail(error),
							BillingSubscriptionReferenceMismatchError: (error) => Effect.fail(error),
						}),
						Effect.catch(() =>
							Effect.fail(new BillingPersistenceError({ operation: "Failed to upsert order" })),
						),
					);
			});

			const authPlugin = polar({
				client: polarClient,
				use: [
					webhooks({
						secret: Resource.PolarWebhookSecret.value,
						onPayload: (payload) =>
							Effect.runPromise(
								Effect.logInfo(`Polar webhook ${payload.type} received`).pipe(
									Effect.annotateLogs({
										type: payload.type,
										...("id" in payload.data ? { polarResourceId: payload.data.id } : {}),
										...("customerId" in payload.data
											? { polarCustomerId: payload.data.customerId }
											: {}),
										...("subscriptionId" in payload.data && payload.data.subscriptionId
											? { polarSubscriptionId: payload.data.subscriptionId }
											: {}),
										...("externalId" in payload.data && payload.data.externalId
											? { organizationId: payload.data.externalId }
											: {}),
									}),
								),
							),
						onCustomerStateChanged: (payload) =>
							Effect.runPromise(upsertCustomerState(payload.data)),
						onOrderCreated: (payload) => Effect.runPromise(upsertOrder(payload.data)),
						onOrderPaid: (payload) => Effect.runPromise(upsertOrder(payload.data)),
						onOrderRefunded: (payload) => Effect.runPromise(upsertOrder(payload.data)),
						onOrderUpdated: (payload) => Effect.runPromise(upsertOrder(payload.data)),
						onSubscriptionCreated: (payload) => Effect.runPromise(upsertSubscription(payload.data)),
						onSubscriptionUpdated: (payload) => Effect.runPromise(upsertSubscription(payload.data)),
						onSubscriptionActive: (payload) => Effect.runPromise(upsertSubscription(payload.data)),
						onSubscriptionCanceled: (payload) =>
							Effect.runPromise(upsertSubscription(payload.data)),
						onSubscriptionRevoked: (payload) => Effect.runPromise(upsertSubscription(payload.data)),
						onSubscriptionUncanceled: (payload) =>
							Effect.runPromise(upsertSubscription(payload.data)),
					}),
				],
			});

			return Service.of({
				authPlugin,
				createCustomer,
				updateCustomer,
				getCustomerState,
				createCheckoutUrl,
				createPortalUrl,
				upsertCustomerState,
				upsertSubscription,
				upsertOrder,
			});
		}),
	);

	export const defaultLayer = layer;
}
