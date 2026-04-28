import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import { Separator } from "@leuchtturm/web/components/ui/separator";
import { useZeroQuery } from "@leuchtturm/web/lib/query";
import { queries } from "@leuchtturm/zero/queries";

export const Route = createFileRoute("/$organization/_settings/teams/$team/settings/members")({
	loader: ({ context: { organizationId, zero }, params: { team } }) => {
		zero.preload(queries.team({ organizationId, team }));
		zero.preload(queries.organizationMembers({ organizationId }));
		zero.preload(queries.teamMembersByTeam({ organizationId, team }));
	},
	component: Page,
});

function Page() {
	const { team } = Route.useParams();

	return <MembersSettings team={team} />;
}

function MembersSettings(props: { readonly team: string }) {
	const { organizationId, session } = Route.useRouteContext();
	const { t } = useTranslation();
	const [team] = useZeroQuery(queries.team({ organizationId, team: props.team }));
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
		<div className="mx-auto w-full max-w-3xl">
			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Team members")}</h2>
					<p className="text-sm text-muted-foreground">{t("Members who can access this team.")}</p>
				</div>
				<div className="mt-5">
					{teamMembers.length ? (
						<ul className="divide-y divide-border">
							{teamMembers.map((teamMember) => {
								const organizationMember = organizationMembers.find(
									(member) => member.userId === teamMember.userId,
								);
								return (
									<li key={teamMember.id} className="flex items-center justify-between gap-4 py-4">
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
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("No team members found.")}
						</div>
					)}
				</div>
			</section>

			<Separator />

			<section className="py-6">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">{t("Add organization members")}</h2>
					<p className="text-sm text-muted-foreground">
						{t("Add existing organization members to this team.")}
					</p>
				</div>
				<div className="mt-5">
					{availableMembers.length ? (
						<ul className="divide-y divide-border">
							{availableMembers.map((member) => (
								<li key={member.id} className="flex items-center justify-between gap-4 py-4">
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
						<div className="py-10 text-center text-sm text-muted-foreground">
							{t("All organization members are already in this team.")}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
