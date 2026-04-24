import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { authClient } from "@leuchtturm/web/clients/auth";
import { deviceSessionsQuery } from "@leuchtturm/web/queries/device-sessions";
import { organizationsQuery } from "@leuchtturm/web/queries/organizations";
import { sessionQuery } from "@leuchtturm/web/queries/session";

export function useAuth() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { queryKey: sessionQueryKey } = sessionQuery();
	const { queryKey: organizationsQueryKey } = organizationsQuery();
	const { data: session } = useQuery(sessionQuery());
	const { data: deviceSessions } = useQuery(deviceSessionsQuery());

	const signOutCurrent = async () => {
		if (!session) return;

		const nextSession = deviceSessions?.find(
			(deviceSession) => deviceSession.session.token !== session.session.token,
		);

		if (nextSession) {
			await authClient.multiSession.setActive({
				sessionToken: nextSession.session.token,
			});
			await authClient.multiSession.revoke({
				sessionToken: session.session.token,
			});
			await queryClient.invalidateQueries({ queryKey: ["session"] });
			await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
			await queryClient.invalidateQueries({ queryKey: organizationsQueryKey });
			await router.invalidate();
			await navigate({ to: "/app" });
			return;
		}

		await authClient.multiSession.revoke({
			sessionToken: session.session.token,
		});
		queryClient.setQueryData(sessionQueryKey, null);
		queryClient.removeQueries({ queryKey: ["deviceSessions"] });
		queryClient.removeQueries({ queryKey: organizationsQueryKey });
		await router.invalidate();
		await navigate({ to: "/login" });
	};

	const signOutAll = async () => {
		const { data: sessions } = await authClient.multiSession.listDeviceSessions();
		if (sessions) {
			for (const deviceSession of sessions) {
				await authClient.multiSession.revoke({ sessionToken: deviceSession.session.token });
			}
		}
		await authClient.signOut();
		queryClient.setQueryData(sessionQueryKey, null);
		queryClient.removeQueries({ queryKey: ["deviceSessions"] });
		queryClient.removeQueries({ queryKey: organizationsQueryKey });
		await router.invalidate();
		await navigate({ to: "/login" });
	};

	const setActiveSession = async (sessionToken: string) => {
		await authClient.multiSession.setActive({ sessionToken });
		await queryClient.invalidateQueries({ queryKey: ["session"] });
		await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
		await queryClient.invalidateQueries({ queryKey: organizationsQueryKey });
		await router.invalidate();
	};

	const invalidateDeviceSessions = async () => {
		await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
		await router.invalidate();
	};

	return {
		signOutCurrent,
		signOutAll,
		setActiveSession,
		invalidateDeviceSessions,
	};
}
