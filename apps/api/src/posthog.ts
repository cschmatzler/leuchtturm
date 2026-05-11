import { PostHog as PostHogEdge } from "posthog-node/edge";
import { Resource } from "sst/resource/cloudflare";

export namespace Posthog {
	export function create(waitUntil?: (promise: Promise<unknown>) => void) {
		return new PostHogEdge(Resource.PostHogProjectApiKey.value, {
			host: Resource.PostHogHost.value,
			waitUntil,
		});
	}
}
