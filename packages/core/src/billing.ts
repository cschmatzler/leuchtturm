import { Polar } from "@polar-sh/sdk";
import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate";
import type { Order } from "@polar-sh/sdk/models/components/order";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription";
import { eq } from "drizzle-orm";
import { Effect, Layer, Schema, Context } from "effect";
import { Resource } from "sst";

import { organization } from "@leuchtturm/core/auth/auth.sql";
import {
	billingCustomer,
	billingOrder,
	billingSubscription,
} from "@leuchtturm/core/billing/billing.sql";
import { POLAR_PRO_PRODUCT_ID } from "@leuchtturm/core/billing/products";
import {
	BillingCustomerSnapshot,
	BillingOrderSnapshot,
	BillingSubscriptionSnapshot,
} from "@leuchtturm/core/billing/schema";
import { Database } from "@leuchtturm/core/drizzle";

export namespace Billing {
	export class BillingError extends Schema.TaggedErrorClass<BillingError>()(
		"BillingError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly createCustomer: (params: {
			readonly organizationId: string;
			readonly name: string;
			readonly slug: string;
		}) => Effect.Effect<void, BillingError>;
		readonly updateCustomer: (params: {
			readonly organizationId: string;
			readonly name: string;
			readonly slug: string;
		}) => Effect.Effect<void, BillingError>;
		readonly getCustomerState: (organizationId: string) => Effect.Effect<CustomerState, BillingError>;
		readonly createCheckoutUrl: (params: {
			readonly organizationId: string;
			readonly successUrl: string;
			readonly returnUrl: string;
		}) => Effect.Effect<string, BillingError>;
		readonly createPortalUrl: (params: {
			readonly organizationId: string;
			readonly returnUrl: string;
		}) => Effect.Effect<string, BillingError>;
		readonly upsertCustomerState: (state: CustomerState) => Effect.Effect<void, BillingError>;
		readonly upsertSubscription: (subscription: Subscription) => Effect.Effect<void, BillingError>;
		readonly upsertOrder: (order: Order) => Effect.Effect<void, BillingError>;
	}

	export class Service extends Context.Service<Service, Interface>()("@leuchtturm/Billing") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const { db } = yield* Database.Service;
			const polarClient = new Polar({
				accessToken: Resource.PolarAccessToken.value,
				server: Resource.ApiConfig.POLAR_SERVER as "production" | "sandbox",
			});

			function buildSubscriptionSnapshot(values: Record<string, unknown>) {
				return Schema.decodeUnknownSync(BillingSubscriptionSnapshot)({
					...values,
					syncedAt: new Date(),
				});
			}

			async function syncCustomerState(
				tx: Database.Executor,
				values: { organizationId: string; state: CustomerState },
			) {
				const customerSnapshot = Schema.decodeUnknownSync(BillingCustomerSnapshot)({
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
				});

				await tx.insert(billingCustomer).values(customerSnapshot).onConflictDoUpdate({
					target: billingCustomer.organizationId,
					set: customerSnapshot,
				});

				for (const subscription of values.state.activeSubscriptions) {
					const subscriptionSnapshot = buildSubscriptionSnapshot({
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

					await tx.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
						target: billingSubscription.id,
						set: subscriptionSnapshot,
					});
				}
			}

			const assertCustomer = Effect.fn("Billing.assertCustomer")(function* (
				resource: string,
				externalId: string | null | undefined,
				organizationId: string | null,
			) {
				if (organizationId) return organizationId;

				if (!externalId) {
					return yield* new BillingError({
						message: `Polar ${resource} webhook payload is missing an external organization id`,
					});
				}

				return yield* new BillingError({
					message: `Polar ${resource} webhook references unknown local organization: ${externalId}`,
				});
			});

			const loadCustomerState = Effect.fn("Billing.loadCustomerState")(function* (
				customerId: string,
			) {
				return yield* Effect.tryPromise({
					try: () => polarClient.customers.getState({ id: customerId }),
					catch: (error) =>
						new BillingError({
							message: `Unable to load Polar customer state for ${customerId}: ${String(error)}`,
						}),
				});
			});

			const loadCustomerStateExternal = Effect.fn("Billing.loadCustomerStateExternal")(function* (
				organizationId: string,
			) {
				return yield* Effect.tryPromise({
					try: () => polarClient.customers.getStateExternal({ externalId: organizationId }),
					catch: (error) =>
						new BillingError({
							message: `Unable to load Polar customer state for organization ${organizationId}: ${String(error)}`,
						}),
				});
			});

			const getKnownOrganizationId = Effect.fn("Billing.getKnownOrganizationId")(function* (
				externalId: string | null | undefined,
			) {
				if (!externalId) return null;

				const rows = yield* Effect.tryPromise({
					try: () =>
						db.select({ id: organization.id }).from(organization).where(eq(organization.id, externalId)).limit(1),
					catch: (error) =>
						new BillingError({
							message: `Failed to look up organization ${externalId}: ${String(error)}`,
						}),
				});

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

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							await syncCustomerState(tx, { organizationId, state });
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to upsert customer state: ${String(error)}`,
						}),
				});
			});

			const createCustomer = Effect.fn("Billing.createCustomer")(function* (params: {
				readonly organizationId: string;
				readonly name: string;
				readonly slug: string;
			}) {
				yield* Effect.tryPromise({
					try: () =>
						polarClient.customers.create({
							type: "team",
							externalId: params.organizationId,
							name: params.name,
							metadata: { slug: params.slug },
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to create billing customer for organization ${params.organizationId}: ${String(error)}`,
						}),
				});

				const state = yield* loadCustomerStateExternal(params.organizationId);
				yield* upsertCustomerState(state);
			});

			const updateCustomer = Effect.fn("Billing.updateCustomer")(function* (params: {
				readonly organizationId: string;
				readonly name: string;
				readonly slug: string;
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
					catch: (error) =>
						new BillingError({
							message: `Failed to update billing customer for organization ${params.organizationId}: ${String(error)}`,
						}),
				});

				const state = yield* loadCustomerStateExternal(params.organizationId);
				yield* upsertCustomerState(state);
			});

			const getCustomerState = Effect.fn("Billing.getCustomerState")(function* (
				organizationId: string,
			) {
				return yield* loadCustomerStateExternal(organizationId);
			});

			const createCheckoutUrl = Effect.fn("Billing.createCheckoutUrl")(function* (params: {
				readonly organizationId: string;
				readonly successUrl: string;
				readonly returnUrl: string;
			}) {
				const checkout = yield* Effect.tryPromise({
					try: () =>
						polarClient.checkouts.create({
							externalCustomerId: params.organizationId,
							products: [POLAR_PRO_PRODUCT_ID],
							successUrl: params.successUrl,
							returnUrl: params.returnUrl,
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to create checkout for organization ${params.organizationId}: ${String(error)}`,
						}),
				});

				return checkout.url;
			});

			const createPortalUrl = Effect.fn("Billing.createPortalUrl")(function* (params: {
				readonly organizationId: string;
				readonly returnUrl: string;
			}) {
				const customerSession = yield* Effect.tryPromise({
					try: () =>
						polarClient.customerSessions.create({
							externalCustomerId: params.organizationId,
							returnUrl: params.returnUrl,
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to create billing portal for organization ${params.organizationId}: ${String(error)}`,
						}),
				});

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

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							await syncCustomerState(tx, {
								organizationId,
								state: customerState,
							});

							const subscriptionSnapshot = buildSubscriptionSnapshot({
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

							await tx.insert(billingSubscription).values(subscriptionSnapshot).onConflictDoUpdate({
								target: billingSubscription.id,
								set: subscriptionSnapshot,
							});
						}),
					catch: (error) =>
						new BillingError({
							message: `Failed to upsert subscription: ${String(error)}`,
						}),
				});
			});

			const upsertOrder = Effect.fn("Billing.upsertOrder")(function* (order: Order) {
				const organizationId = yield* getKnownOrganizationId(order.customer.externalId);
				const customerState = organizationId ? yield* loadCustomerState(order.customerId) : null;

				yield* Effect.tryPromise({
					try: () =>
						db.transaction(async (tx) => {
							if (organizationId && customerState) {
								await syncCustomerState(tx, {
									organizationId,
									state: customerState,
								});

								if (order.subscriptionId) {
									const [existingSubscription] = await tx
										.select({
											id: billingSubscription.id,
											polarCustomerId: billingSubscription.polarCustomerId,
											organizationId: billingSubscription.organizationId,
										})
										.from(billingSubscription)
										.where(eq(billingSubscription.id, order.subscriptionId))
										.limit(1);

									if (existingSubscription) {
										if (
											existingSubscription.organizationId !== organizationId ||
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

										const subscriptionSnapshot = buildSubscriptionSnapshot({
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
							});

							await tx.insert(billingOrder).values(orderSnapshot).onConflictDoUpdate({
								target: billingOrder.id,
								set: orderSnapshot,
							});
						}),
					catch: (error) => {
						if (
							error &&
							typeof error === "object" &&
							"_tag" in error &&
							error._tag === "BillingError"
						) {
							return error as BillingError;
						}
						return new BillingError({
							message: `Failed to upsert order: ${String(error)}`,
						});
					},
				});
			});

			return Service.of({
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
