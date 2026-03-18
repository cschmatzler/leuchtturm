import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { authClient } from "@chevrotain/web/clients/auth";
import { sessionQuery } from "@chevrotain/web/queries/session";

export function useAuth() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();
	const { queryKey: sessionQueryKey } = sessionQuery();

	const signOut = async () => {
		await authClient.signOut();
		queryClient.setQueryData(sessionQueryKey, null);
		queryClient.removeQueries({ queryKey: ["deviceSessions"] });
		await router.invalidate();
		navigate({ to: "/login" });
	};

	const switchSession = async (sessionToken: string) => {
		await authClient.multiSession.setActive({ sessionToken });
		await queryClient.invalidateQueries({ queryKey: ["session"] });
		await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
		await router.invalidate();
	};

	const revokeSession = async (sessionToken: string) => {
		await authClient.multiSession.revoke({ sessionToken });
		await queryClient.invalidateQueries({ queryKey: ["deviceSessions"] });
	};

	const signOutAll = async () => {
		const { data: sessions } = await authClient.multiSession.listDeviceSessions();
		if (sessions) {
			for (const session of sessions) {
				await authClient.multiSession.revoke({ sessionToken: session.session.token });
			}
		}
		await authClient.signOut();
		queryClient.setQueryData(sessionQueryKey, null);
		queryClient.removeQueries({ queryKey: ["deviceSessions"] });
		await router.invalidate();
		navigate({ to: "/login" });
	};

	return {
		signOut,
		switchSession,
		revokeSession,
		signOutAll,
	};
}
