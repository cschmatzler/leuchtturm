const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "0.0.0.0", "localhost"]);

export function getBaseUrl() {
	return globalThis.location.origin;
}

export function getApiBaseUrl() {
	return getBaseUrl();
}

export function getSyncUrl() {
	const url = new URL(getBaseUrl());

	if (LOCAL_HOSTNAMES.has(url.hostname)) {
		url.pathname = "/sync";
		url.search = "";
		url.hash = "";
		return url.toString();
	}

	url.hostname = `sync.${url.hostname}`;
	url.pathname = "";
	url.search = "";
	url.hash = "";
	return url.toString();
}
