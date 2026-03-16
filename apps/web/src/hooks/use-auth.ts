import { useNavigate } from "@tanstack/react-router";

import { authClient } from "@one/web/clients/auth";

export function useAuth() {
	const navigate = useNavigate();

	const signOut = async () => {
		await authClient.signOut();
		navigate({ to: "/login" });
	};

	return {
		signOut,
	};
}
