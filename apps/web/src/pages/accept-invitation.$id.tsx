import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { T, useGT, Var } from "gt-react";
import { useState } from "react";
import { toast } from "sonner";

import { Role } from "@leuchtturm/core/auth/schema";
import { authClient } from "@leuchtturm/web/clients/auth";
import { Button } from "@leuchtturm/web/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@leuchtturm/web/components/ui/card";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";
import { deviceSessionsQuery } from "@leuchtturm/web/queries/device-sessions";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export const Route = createFileRoute("/accept-invitation/$id")({
	beforeLoad: async ({ context: { queryClient } }) => {
		const session = await queryClient.ensureQueryData(sessionQuery());

		if (!session) {
			throw redirect({ to: "/login" });
		}

		return { session };
	},
	loader: async ({ context: { queryClient }, params: { id } }) => {
		const deviceSessions = await queryClient.ensureQueryData(deviceSessionsQuery());

		const sessionInvitations: Array<{
			sessionToken: string;
			data: {
				id: string;
				organizationId: string;
				email: string;
				role: typeof Role.Type;
				status: "pending" | "accepted" | "rejected" | "canceled";
				inviterId: string;
				expiresAt: Date;
				organizationName: string;
				organizationSlug: string;
				inviterEmail: string;
			} | null;
			error: {
				message?: string;
				status?: number;
				code?: string;
			} | null;
		}> = [];

		for (const deviceSession of deviceSessions) {
			await authClient.multiSession.setActive({
				sessionToken: deviceSession.session.token,
			});
			const res = await authClient.organization.getInvitation({
				query: { id },
			});
			sessionInvitations.push({ ...res, sessionToken: deviceSession.session.token });
		}

		const invitation = sessionInvitations.find((res) => !res.error);
		if (!invitation) throw redirect({ to: "/" });

		await authClient.multiSession.setActive({
			sessionToken: invitation.sessionToken,
		});
		await queryClient.invalidateQueries({ queryKey: ["session"] });
		const session = await queryClient.ensureQueryData(sessionQuery());

		return { invitation, session };
	},
	component: Page,
});

function Page() {
	const { id } = Route.useParams();
	const { invitation } = Route.useLoaderData();
	const navigate = useNavigate();

	const queryClient = useQueryClient();

	const t = useGT();
	const { invalidateDeviceSessions } = useAuth();

	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleAccept = async () => {
		setIsSubmitting(true);
		const { data, error } = await authClient.organization.acceptInvitation({
			invitationId: id,
		});

		if (error || !data) {
			toast.error(t("Failed to accept invitation."));
			setIsSubmitting(false);
			return;
		}

		await queryClient.invalidateQueries({ queryKey: ["organizations"] });
		await invalidateDeviceSessions();

		toast.success(t("Successfully joined organization!"));
		if (invitation.data?.organizationSlug) {
			await navigate({
				to: "/$organization/settings",
				params: { organization: invitation.data.organizationSlug },
			});
			return;
		}

		await navigate({ to: "/app" });
	};

	const handleReject = async () => {
		await authClient.organization.rejectInvitation({
			invitationId: id,
		});
		await navigate({ to: "/app" });
	};

	return (
		<div className="flex h-dvh w-dvw flex-col items-center gap-4 bg-background px-3 py-2">
			<div className="flex w-full justify-between">
				<Button onClick={() => navigate({ to: "/app" })} size="sm" variant="ghost">
					<CaretLeftIcon className="mr-2 size-3" />
					<T>Go back</T>
				</Button>
			</div>
			<div className="flex h-full w-full max-w-240 translate-y-1/4 flex-col">
				<Card>
					<CardHeader>
						<CardTitle>
							<T>Accept invitation</T>
						</CardTitle>
						<CardDescription>
							<T>You&apos;ve been invited to join an organization</T>
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-sm text-muted-foreground">
							<T>
								Invitation for <Var>{invitation.data?.email}</Var>
							</T>
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								onClick={handleAccept}
								loading={isSubmitting}
								className="flex-1"
							>
								<T>Accept</T>
							</Button>
							<Button type="button" variant="outline" onClick={handleReject} className="flex-1">
								<T>Reject</T>
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
