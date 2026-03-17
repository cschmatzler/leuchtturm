const baseUrl = import.meta.env.VITE_BASE_URL;

async function postJson(path: string, body: unknown): Promise<unknown> {
	const response = await fetch(`${baseUrl}/api${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	return response.json();
}

/**
 * Typed API client matching the previous hc<Routes> shape.
 * Only the two endpoints used by the web app are implemented.
 */
export const api = {
	analytics: {
		$post: (opts: { json: { events: unknown[] } }) => postJson("/analytics", opts.json),
	},
	errors: {
		$post: (opts: { json: { errors: unknown[] } }) => postJson("/errors", opts.json),
	},
};
