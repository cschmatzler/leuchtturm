import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/teams/$team/settings/members")({
	loader: ({ context: { organizationId, zero }, params: { team: teamSlug } }) => {
		zero.preload(queries.team({ organizationId, teamSlug }));
		zero.preload(queries.organizationMembers({ organizationId }));
		zero.preload(queries.teamMembersByTeam({ organizationId, teamSlug }));
	},
	component: Page,
});

function Page() {
	const { team: teamSlug } = Route.useParams();
	const { organizationId, session } = Route.useRouteContext();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, teamSlug }));
	const [organizationMembers] = useZeroQuery(queries.organizationMembers({ organizationId }));
	const [teamMembers] = useZeroQuery(queries.teamMembers({ teamId: team?.id ?? "" }));
	const teamMemberUserIds = new Set(teamMembers.map((member) => member.userId));
	const availableMembers = organizationMembers.filter(
		(member) => !teamMemberUserIds.has(member.userId),
	);

	const addMember = async (userId: string) => {
		if (!team) return;
		const { error } = await authClient.organization.addTeamMember({
			teamId: team.id,
			userId,
			organizationId,
		});
		if (error) throw error;
		toast.success(t("Team member added"));
	};

	const removeMember = async (userId: string) => {
		if (!team) return;
		if (
			userId === session.user.id ||
			organizationMembers.find((member) => member.userId === userId)?.role === "owner"
		) {
			toast.error(t("This team member cannot be removed"));
			return;
		}
		const { error } = await authClient.organization.removeTeamMember({
			teamId: team.id,
			userId,
			organizationId,
		});
		if (error) throw error;
		toast.success(t("Team member removed"));
	};

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Team members")}</CardTitle>
					<CardDescription>{t("Members who can access this team.")}</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border p-0">
					{teamMembers.length ? (
						<ul className="divide-y divide-border">
							{teamMembers.map((teamMember) => {
								const organizationMember = organizationMembers.find(
									(member) => member.userId === teamMember.userId,
								);
								return (
									<li
										key={teamMember.id}
										className="flex items-center justify-between gap-4 px-6 py-4"
									>
										<div>
											<p className="text-sm font-medium">
												{organizationMember?.user?.name ??
													teamMember.user?.name ??
													teamMember.userId}
											</p>
											{(organizationMember?.user?.email ?? teamMember.user?.email) && (
												<p className="text-xs text-muted-foreground">
													{organizationMember?.user?.email ?? teamMember.user?.email}
												</p>
											)}
										</div>
										{teamMember.userId !== session.user.id &&
										organizationMember?.role !== "owner" ? (
											<Button
												variant="destructive"
												size="sm"
												onClick={() => void removeMember(teamMember.userId)}
											>
												<Trash2Icon className="size-4" />
												{t("Remove")}
											</Button>
										) : null}
									</li>
								);
							})}
						</ul>
					) : (
						<div className="px-6 py-10 text-center text-sm text-muted-foreground">
							{t("No team members found.")}
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="gap-0 overflow-hidden p-0">
				<CardHeader className="px-6 py-5">
					<CardTitle className="text-base">{t("Add organization members")}</CardTitle>
					<CardDescription>{t("Add existing organization members to this team.")}</CardDescription>
				</CardHeader>
				<CardContent className="border-t border-border p-0">
					{availableMembers.length ? (
						<ul className="divide-y divide-border">
							{availableMembers.map((member) => (
								<li key={member.id} className="flex items-center justify-between gap-4 px-6 py-4">
									<div>
										<p className="text-sm font-medium">{member.user?.name ?? member.userId}</p>
										{member.user?.email && (
											<p className="text-xs text-muted-foreground">{member.user.email}</p>
										)}
									</div>
									<Button variant="outline" size="sm" onClick={() => void addMember(member.userId)}>
										<PlusIcon className="size-4" />
										{t("Add")}
									</Button>
								</li>
							))}
						</ul>
					) : (
						<div className="px-6 py-10 text-center text-sm text-muted-foreground">
							{t("All organization members are already in this team.")}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
