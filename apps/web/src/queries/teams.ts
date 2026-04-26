import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@leuchtturm/web/clients/auth";

export type Team = {
	readonly id: string;
	readonly name: string;
	readonly organizationId: string;
	readonly createdAt: Date;
	readonly updatedAt?: Date;
};

export type TeamMember = {
	readonly id: string;
	readonly teamId: string;
	readonly userId: string;
	readonly createdAt: Date;
};

export type OrganizationMember = {
	readonly id: string;
	readonly organizationId: string;
	readonly userId: string;
	readonly role: string;
	readonly createdAt: Date;
	readonly user?: {
		readonly id: string;
		readonly name: string;
		readonly email: string;
		readonly image?: string | null;
	};
};

export const teamsQuery = (organizationId: string) =>
	queryOptions({
		queryKey: ["teams", organizationId] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<readonly Team[]> => {
			const { data, error } = await authClient.organization.listTeams({
				query: { organizationId },
			});
			if (error) throw error;
			return data;
		},
	});

export const teamMembersQuery = (teamId: string) =>
	queryOptions({
		queryKey: ["teamMembers", teamId] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<readonly TeamMember[]> => {
			const { data, error } = await authClient.organization.listTeamMembers({
				query: { teamId },
			});
			if (error) throw error;
			return data;
		},
	});

export const organizationMembersQuery = (organizationId: string) =>
	queryOptions({
		queryKey: ["organizationMembers", organizationId] as const,
		staleTime: 30 * 1000,
		queryFn: async (): Promise<readonly OrganizationMember[]> => {
			const { data, error } = await authClient.organization.listMembers({
				query: { organizationId },
			});
			if (error) throw error;
			return data.members;
		},
	});
