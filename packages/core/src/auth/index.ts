import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { multiSession } from "better-auth/plugins";
import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";
import { ulid } from "ulid";

import * as schema from "@chevrotain/core/auth/auth.sql";
import {
	AccountId,
	JWKSId,
	PASSWORD_MIN_LENGTH,
	Session,
	SessionId,
	User,
	UserId,
	VerificationId,
} from "@chevrotain/core/auth/schema";
import { POLAR_PRO_PRODUCT_ID, POLAR_PRO_PRODUCT_SLUG } from "@chevrotain/core/billing/products";
import { makePolarWebhookHandlers } from "@chevrotain/core/billing/webhooks";
import { CoreConfig } from "@chevrotain/core/config";
import { Database } from "@chevrotain/core/drizzle/index";
import { Email } from "@chevrotain/core/email";
import { sendPasswordResetEmail } from "@chevrotain/email/password-reset";

function isIpAddress(hostname: string) {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

function getParentDomain(hostname: string) {
	const labels = hostname.split(".").filter(Boolean);

	if (hostname === "localhost" || isIpAddress(hostname) || labels.length < 3) {
		return null;
	}

	return labels.slice(1).join(".");
}

export function deriveCrossSubDomainCookieDomain(baseUrl: string, authBaseUrl: string) {
	const baseHost = new URL(baseUrl).hostname;
	const authHost = new URL(authBaseUrl).hostname;

	if (baseHost === authHost) {
		return null;
	}

	const baseParentDomain = getParentDomain(baseHost);
	const authParentDomain = getParentDomain(authHost);

	if (baseParentDomain && baseParentDomain === authParentDomain) {
		return baseParentDomain;
	}

	if (baseParentDomain && authHost === baseParentDomain) {
		return baseParentDomain;
	}

	if (authParentDomain && baseHost === authParentDomain) {
		return authParentDomain;
	}

	return null;
}

export namespace Auth {
	export interface SessionData {
		readonly user: User;
		readonly session: Session;
	}

	export class AuthError extends Schema.TaggedErrorClass<AuthError>()("AuthError", {
		message: Schema.String,
	}) {}

	export interface Interface {
		readonly handle: (request: Request) => Effect.Effect<Response, AuthError>;
		readonly getSession: (headers: Headers) => Effect.Effect<SessionData | null, AuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/Auth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const config = yield* CoreConfig;
			const { db } = yield* Database.Service;
			const crossSubDomainCookieDomain = deriveCrossSubDomainCookieDomain(
				config.baseUrl,
				config.auth.authBaseUrl,
			);
			const polarClient = new Polar({
				accessToken: Redacted.value(config.billing.accessToken),
				server: config.billing.server,
			});
			const polarWebhookHandlers = makePolarWebhookHandlers(db);
			const auth = betterAuth({
				baseURL: `${config.auth.authBaseUrl}/api/auth`,
				trustedOrigins: [config.baseUrl, config.auth.authBaseUrl],
				database: drizzleAdapter(db, {
					provider: "pg",
					schema,
				}),
				emailAndPassword: {
					enabled: true,
					minPasswordLength: PASSWORD_MIN_LENGTH,
					sendResetPassword: async ({ user, url }, _request) =>
						sendPasswordResetEmail({
							email: user.email,
							resetUrl: url,
							send: Email.send,
							userName: user.name,
						}),
				},
				user: {
					additionalFields: {
						language: {
							type: "string",
							required: false,
							default: "en",
						},
					},
				},
				socialProviders: {
					github: {
						clientId: config.auth.githubClientId,
						clientSecret: Redacted.value(config.auth.githubClientSecret),
					},
				},
				plugins: [
					multiSession(),
					polar({
						client: polarClient,
						createCustomerOnSignUp: true,
						use: [
							checkout({
								products: [
									{
										productId: POLAR_PRO_PRODUCT_ID,
										slug: POLAR_PRO_PRODUCT_SLUG,
									},
								],
								successUrl: config.billing.successUrl,
								returnUrl: `${config.baseUrl}/app/settings/billing`,
								authenticatedUsersOnly: true,
							}),
							portal({
								returnUrl: `${config.baseUrl}/app/settings/billing`,
							}),
							webhooks({
								secret: Redacted.value(config.billing.webhookSecret),
								...polarWebhookHandlers,
							}),
						],
					}),
				],
				session: {
					cookieCache: {
						enabled: true,
						maxAge: 5 * 60,
					},
				},
				advanced: {
					...(crossSubDomainCookieDomain
						? {
								crossSubDomainCookies: {
									enabled: true,
									domain: crossSubDomainCookieDomain,
								},
							}
						: {}),
					database: {
						generateId: ({ model }) => {
							switch (model) {
								case "account":
									return AccountId.makeUnsafe(`acc_${ulid()}`);
								case "user":
									return UserId.makeUnsafe(`usr_${ulid()}`);
								case "session":
									return SessionId.makeUnsafe(`ses_${ulid()}`);
								case "verification":
									return VerificationId.makeUnsafe(`ver_${ulid()}`);
								case "jwks":
									return JWKSId.makeUnsafe(`jwk_${ulid()}`);
								default:
									throw new Error(`Unknown auth model: ${model}`);
							}
						},
					},
				},
			});

			const decodeSessionData = (sessionData: { user: unknown; session: unknown }) =>
				Effect.all({
					user: Schema.decodeUnknownEffect(User)(sessionData.user),
					session: Schema.decodeUnknownEffect(Session)(sessionData.session),
				}).pipe(
					Effect.mapError(
						(error) =>
							new AuthError({
								message: `Invalid auth session payload: ${error.message}`,
							}),
					),
				);

			const handle = Effect.fn("Auth.handle")(function* (request: Request) {
				return yield* Effect.tryPromise({
					try: () => auth.handler(request),
					catch: (error) =>
						new AuthError({
							message: `Auth handler failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});
			});

			const getSession = Effect.fn("Auth.getSession")(function* (headers: Headers) {
				const session = yield* Effect.tryPromise({
					try: () => auth.api.getSession({ headers }),
					catch: (error) =>
						new AuthError({
							message: `Auth getSession failed: ${error instanceof Error ? error.message : String(error)}`,
						}),
				});

				if (!session) {
					return null;
				}

				return yield* decodeSessionData({
					user: session.user,
					session: session.session,
				});
			});

			return Service.of({ handle, getSession });
		}),
	);

	export const defaultLayer = layer.pipe(Layer.provide(Database.defaultLayer));
}
