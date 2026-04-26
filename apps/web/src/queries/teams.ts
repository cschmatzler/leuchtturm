export type Team = {
	readonly id: string;
	readonly name: string;
	readonly slug: string;
	readonly organizationId: string;
	readonly createdAt: number;
	readonly updatedAt?: number;
};

export type TeamMember = {
	readonly id: string;
	readonly teamId: string;
	readonly userId: string;
	readonly createdAt: number;
};
