export type RequestLike = {
	readonly method: string;
	readonly url: string;
};

export interface RequestDetails {
	readonly host?: string;
	readonly method: string;
	readonly path: string;
	readonly scheme: string;
}

const InternalHost = "internal";

const parseRequestUrl = (url: string) => {
	try {
		return new URL(url);
	} catch {
		return new URL(url, `http://${InternalHost}`);
	}
};

export const describeRequest = (request: RequestLike): RequestDetails => {
	const url = parseRequestUrl(request.url);

	return {
		host: url.host === InternalHost ? undefined : url.host,
		method: request.method,
		path: url.pathname,
		scheme: url.protocol.replace(":", ""),
	};
};

export const requestPath = (request: RequestLike) => describeRequest(request).path;

export const requestSpanName = (request: RequestLike) => {
	const details = describeRequest(request);
	return `${details.method} ${details.path}`;
};

export const requestSpanAttributes = (request: RequestLike): Record<string, string> => {
	const details = describeRequest(request);

	return {
		"http.request.method": details.method,
		"http.route": details.path,
		"url.path": details.path,
		"url.scheme": details.scheme,
		...(details.host ? { "server.address": details.host } : {}),
	};
};

export const requestLogAnnotations = (
	request: RequestLike,
	annotations: Record<string, unknown> = {},
): Record<string, unknown> => {
	const details = describeRequest(request);

	return {
		method: details.method,
		path: details.path,
		...annotations,
	};
};

export const requestMetricTags = (
	request: RequestLike,
	extraTags: Record<string, string> = {},
): Record<string, string> => {
	const details = describeRequest(request);

	return {
		method: details.method,
		path: details.path,
		...extraTags,
	};
};

export const statusGroup = (status: number) => `${Math.floor(status / 100)}xx`;
