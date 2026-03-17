import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";

import { authClient } from "@one/web/clients/auth";

export function useAuth() {
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();

	const signOut = async () => {
		await authClient.signOut();
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
		navigate({ to: "/login" });
	};

	return {
		signOut,
		switchSession,
		revokeSession,
		signOutAll,
	};
}
