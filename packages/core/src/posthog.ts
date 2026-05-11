import { PostHog } from "posthog-node/edge";
import { Resource } from "sst";

export namespace PostHogClient {
	export function create(waitUntil?: (promise: Promise<unknown>) => void) {
		return new PostHog(Resource.PostHogProjectApiKey.value, {
			host: Resource.PostHogHost.value,
			waitUntil,
		});
	}
}
