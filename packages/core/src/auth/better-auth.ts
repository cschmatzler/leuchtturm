import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, multiSession, openAPI, organization, twoFactor } from "better-auth/plugins";
import { and, eq, ne } from "drizzle-orm";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { AsyncLocalStorage } from "node:async_hooks";
import { Resource } from "sst/resource/cloudflare";
import { ulid } from "ulid";

import {
	accountTable,
	invitationTable,
	memberTable,
	organizationTable,
	sessionTable,
	teamTable,
	teamMemberTable,
	twoFactorTable,
	userTable,
	verificationTable,
} from "@leuchtturm/core/auth/auth.sql";
import {
	AuthDuplicateOrganizationNameError,
	AuthDuplicateTeamNameError,
	AuthInvitationEmailError,
	AuthVerificationEmailError,
} from "@leuchtturm/core/auth/errors";
import {
	AccountSelect,
	InvitationSelect,
	MemberSelect,
	OrganizationInsert,
	OrganizationSelect,
	SessionSelect,
	TeamInsert,
	TeamMemberSelect,
	TeamSelect,
	TwoFactorSelect,
	UserSelect,
	VerificationSelect,
} from "@leuchtturm/core/auth/schema";
import { Billing } from "@leuchtturm/core/billing";
import { Database } from "@leuchtturm/core/database";
import { Email } from "@leuchtturm/email";
import { sendEmailVerificationEmail } from "@leuchtturm/email/templates/email-verification";
import { sendInvitationEmail } from "@leuchtturm/email/templates/invitation";

export const createBetterAuth = Effect.fn("Auth.createBetterAuth")(function* (
	context: AsyncLocalStorage<Context.Context<never>>,
) {
	const { database, rawDatabase } = yield* Database.Service;
	const billing = yield* Billing.Service;
	const email = yield* Email.Service;

	return betterAuth({
		baseURL: `https://${Resource.Dns.ApiDomain}/auth`,
		trustedOrigins: [`https://${Resource.Dns.AppDomain}`],
		secret: Resource.BetterAuthSecret.value,
		onAPIError: {
			throw: true,
		},
		database: drizzleAdapter(rawDatabase, {
			provider: "pg",
			schema: {
				account: accountTable,
				session: sessionTable,
				user: userTable,
				verification: verificationTable,
				twoFactor: twoFactorTable,
				organization: organizationTable,
				member: memberTable,
				invitation: invitationTable,
				team: teamTable,
				teamMember: teamMemberTable,
			},
		}),
		user: {
			additionalFields: {
				language: {
					type: "string",
					required: false,
					default: "en",
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
		},
		emailVerification: {
			sendOnSignUp: true,
			sendOnSignIn: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: (params) =>
				Effect.runPromiseWith(context.getStore() ?? Context.empty())(
					sendEmailVerificationEmail({
						verificationUrl: params.url,
						email: params.user.email,
						send: (params) => email.send(params),
					}).pipe(
						Effect.catchCause((cause) =>
							Effect.gen(function* () {
								yield* Effect.annotateCurrentSpan({
									"error.original_cause": Cause.pretty(cause),
								});
								return yield* Effect.fail(new AuthVerificationEmailError());
							}),
						),
					),
				),
		},
		socialProviders: {
			google: {
				clientId: Resource.GoogleClientId.value,
				clientSecret: Resource.GoogleClientSecret.value,
			},
		},
		plugins: [
			admin(),
			multiSession(),
			openAPI(),
			twoFactor({
				issuer: "Leuchtturm",
			}),
			organization({
				sendInvitationEmail: (params) =>
					Effect.runPromiseWith(context.getStore() ?? Context.empty())(
						sendInvitationEmail({
							acceptUrl: `https://${Resource.Dns.AppDomain}/accept-invitation/${params.id}`,
							email: params.email,
							inviterName: params.inviter.user.name,
							organizationName: params.organization.name,
							send: (params) => email.send(params),
						}).pipe(
							Effect.catchCause((cause) =>
								Effect.gen(function* () {
									yield* Effect.annotateCurrentSpan({
										"error.original_cause": Cause.pretty(cause),
									});
									return yield* Effect.fail(new AuthInvitationEmailError());
								}),
							),
						),
					),
				teams: {
					enabled: true,
					defaultTeam: {
						enabled: true,
					},
				},
				schema: {
					team: {
						additionalFields: {
							slug: {
								type: "string",
								required: true,
							},
						},
					},
				},
				organizationHooks: {
					beforeCreateOrganization: ({ organization }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.gen(function* () {
								const organizationName = yield* Schema.decodeEffect(OrganizationInsert.fields.name)(
									organization.name ?? "",
								);
								const existingOrganization = yield* database
									.select({ id: organizationTable.id })
									.from(organizationTable)
									.where(eq(organizationTable.slug, organizationName.toLowerCase()))
									.limit(1);

								if (existingOrganization.length > 0) {
									return yield* new AuthDuplicateOrganizationNameError();
								}

								return {
									data: {
										...organization,
										name: organizationName,
										slug: organizationName.toLowerCase(),
									},
								};
							}),
						),
					afterCreateOrganization: ({ organization, user }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							billing.createCustomer({
								organizationId: organization.id,
								name: organization.name,
								slug: organization.slug,
								ownerEmail: user.email,
								ownerName: user.name,
							}),
						),
					beforeUpdateOrganization: ({ organization, member }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.logInfo("Auth organization update requested").pipe(
								Effect.annotateLogs({
									organizationId: member.organizationId,
									updatedFields: Object.keys(organization).sort().join(","),
								}),
							),
						),
					afterUpdateOrganization: ({ organization }) => {
						const updatedOrganization = organization!;

						return Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.gen(function* () {
								yield* Effect.logInfo("Auth organization updated").pipe(
									Effect.annotateLogs({ organizationId: updatedOrganization.id }),
								);

								return yield* billing.updateCustomer({
									organizationId: updatedOrganization.id,
									name: updatedOrganization.name,
									slug: updatedOrganization.slug,
								});
							}),
						);
					},
					beforeCreateTeam: ({ team, organization }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.gen(function* () {
								const teamName = yield* Schema.decodeEffect(TeamInsert.fields.name)(team.name);
								const existingTeam = yield* database
									.select({ id: teamTable.id })
									.from(teamTable)
									.where(
										and(
											eq(teamTable.organizationId, organization.id),
											eq(teamTable.slug, teamName.toLowerCase()),
										),
									)
									.limit(1);

								if (existingTeam.length > 0) {
									return yield* new AuthDuplicateTeamNameError();
								}

								return {
									data: {
										...team,
										name: teamName,
										slug: teamName.toLowerCase(),
										organizationId: organization.id,
									},
								};
							}),
						),
					beforeUpdateTeam: ({ team, updates, organization }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.gen(function* () {
								yield* Effect.logInfo("Auth team update requested").pipe(
									Effect.annotateLogs({
										teamId: team.id,
										organizationId: organization.id,
										updatedFields: Object.keys(updates).sort().join(","),
									}),
								);

								if (updates.name === undefined) {
									return { data: updates };
								}

								const teamName = yield* Schema.decodeEffect(TeamInsert.fields.name)(updates.name);
								const existingTeam = yield* database
									.select({ id: teamTable.id })
									.from(teamTable)
									.where(
										and(
											ne(teamTable.id, team.id),
											eq(teamTable.slug, teamName.toLowerCase()),
											eq(teamTable.organizationId, organization.id),
										),
									)
									.limit(1);

								if (existingTeam.length > 0) {
									return yield* new AuthDuplicateTeamNameError();
								}

								return {
									data: {
										...updates,
										name: teamName,
										slug: teamName.toLowerCase(),
									},
								};
							}),
						),
					afterUpdateTeam: ({ team, organization }) =>
						Effect.runPromiseWith(context.getStore() ?? Context.empty())(
							Effect.logInfo("Auth team updated").pipe(
								Effect.annotateLogs({
									teamId: team!.id,
									organizationId: organization.id,
								}),
							),
						),
				},
			}),
			billing.authPlugin,
		],
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		advanced: {
			crossSubDomainCookies: {
				enabled: true,
				domain: Resource.Dns.AppDomain,
			},
			database: {
				generateId: ({ model }) => {
					switch (model) {
						case "account":
							return Schema.decodeSync(AccountSelect.fields.id)(`acc_${ulid()}`);
						case "user":
							return Schema.decodeSync(UserSelect.fields.id)(`usr_${ulid()}`);
						case "session":
							return Schema.decodeSync(SessionSelect.fields.id)(`ses_${ulid()}`);
						case "verification":
							return Schema.decodeSync(VerificationSelect.fields.id)(`ver_${ulid()}`);
						case "twoFactor":
							return Schema.decodeSync(TwoFactorSelect.fields.id)(`tfa_${ulid()}`);
						case "organization":
							return Schema.decodeSync(OrganizationSelect.fields.id)(`org_${ulid()}`);
						case "member":
							return Schema.decodeSync(MemberSelect.fields.id)(`mem_${ulid()}`);
						case "invitation":
							return Schema.decodeSync(InvitationSelect.fields.id)(`inv_${ulid()}`);
						case "team":
							return Schema.decodeSync(TeamSelect.fields.id)(`tea_${ulid()}`);
						case "teamMember":
							return Schema.decodeSync(TeamMemberSelect.fields.id)(`tmb_${ulid()}`);
						default:
							throw new Error(`Unknown auth model: ${model}`);
					}
				},
			},
		},
	});
});
