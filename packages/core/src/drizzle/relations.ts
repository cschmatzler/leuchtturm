import { defineRelationsPart } from "drizzle-orm";

import {
	account,
	invitation,
	member,
	organization,
	session,
	team,
	teamMember,
	user,
	verification,
} from "@leuchtturm/core/auth/auth.sql";
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
		organization,
		member,
		team,
		teamMember,
		invitation,
		billingCustomer,
		billingSubscription,
		billingOrder,
	},
	(r) => ({
		user: {
			sessions: r.many.session({ from: r.user.id, to: r.session.userId }),
			accounts: r.many.account({ from: r.user.id, to: r.account.userId }),
			memberships: r.many.member({ from: r.user.id, to: r.member.userId }),
			invitationsSent: r.many.invitation({ from: r.user.id, to: r.invitation.inviterId }),
		},
		session: {
			user: r.one.user({ from: r.session.userId, to: r.user.id }),
			activeOrganization: r.one.organization({
				from: r.session.activeOrganizationId,
				to: r.organization.id,
			}),
			activeTeam: r.one.team({ from: r.session.activeTeamId, to: r.team.id }),
		},
		account: {
			user: r.one.user({ from: r.account.userId, to: r.user.id }),
		},
		verification: {},
		organization: {
			members: r.many.member({ from: r.organization.id, to: r.member.organizationId }),
			teams: r.many.team({ from: r.organization.id, to: r.team.organizationId }),
			invitations: r.many.invitation({
				from: r.organization.id,
				to: r.invitation.organizationId,
			}),
			billingCustomer: r.one.billingCustomer({
				from: r.organization.id,
				to: r.billingCustomer.organizationId,
			}),
			billingSubscriptions: r.many.billingSubscription({
				from: r.organization.id,
				to: r.billingSubscription.organizationId,
			}),
			billingOrders: r.many.billingOrder({
				from: r.organization.id,
				to: r.billingOrder.organizationId,
			}),
		},
		member: {
			organization: r.one.organization({ from: r.member.organizationId, to: r.organization.id }),
			user: r.one.user({ from: r.member.userId, to: r.user.id }),
		},
		team: {
			organization: r.one.organization({ from: r.team.organizationId, to: r.organization.id }),
			members: r.many.teamMember({ from: r.team.id, to: r.teamMember.teamId }),
		},
		teamMember: {
			team: r.one.team({ from: r.teamMember.teamId, to: r.team.id }),
			user: r.one.user({ from: r.teamMember.userId, to: r.user.id }),
		},
		invitation: {
			organization: r.one.organization({
				from: r.invitation.organizationId,
				to: r.organization.id,
			}),
			inviter: r.one.user({ from: r.invitation.inviterId, to: r.user.id }),
		},
		billingCustomer: {
			organization: r.one.organization({
				from: r.billingCustomer.organizationId,
				to: r.organization.id,
			}),
			subscriptions: r.many.billingSubscription({
				from: [r.billingCustomer.organizationId, r.billingCustomer.polarCustomerId],
				to: [r.billingSubscription.organizationId, r.billingSubscription.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingCustomer.organizationId, r.billingCustomer.polarCustomerId],
				to: [r.billingOrder.organizationId, r.billingOrder.polarCustomerId],
			}),
		},
		billingSubscription: {
			organization: r.one.organization({
				from: r.billingSubscription.organizationId,
				to: r.organization.id,
			}),
			customer: r.one.billingCustomer({
				from: [r.billingSubscription.organizationId, r.billingSubscription.polarCustomerId],
				to: [r.billingCustomer.organizationId, r.billingCustomer.polarCustomerId],
			}),
			orders: r.many.billingOrder({
				from: [r.billingSubscription.id, r.billingSubscription.organizationId],
				to: [r.billingOrder.subscriptionId, r.billingOrder.organizationId],
			}),
		},
		billingOrder: {
			organization: r.one.organization({
				from: r.billingOrder.organizationId,
				to: r.organization.id,
			}),
			customer: r.one.billingCustomer({
				from: [r.billingOrder.organizationId, r.billingOrder.polarCustomerId],
				to: [r.billingCustomer.organizationId, r.billingCustomer.polarCustomerId],
			}),
			subscription: r.one.billingSubscription({
				from: [r.billingOrder.subscriptionId, r.billingOrder.organizationId],
				to: [r.billingSubscription.id, r.billingSubscription.organizationId],
			}),
		},
	}),
);
