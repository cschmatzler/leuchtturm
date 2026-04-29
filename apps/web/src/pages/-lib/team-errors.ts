export function isTeamNameError(error: { readonly code?: string; readonly message?: string }) {
	return (
		error.code === "AuthDuplicateTeamNameError" ||
		error.code === "AuthInvalidTeamPayloadError" ||
		error.message === "Team name already exists" ||
		error.message === "Team name must contain only ASCII letters, numbers, dashes, and underscores"
	);
}
