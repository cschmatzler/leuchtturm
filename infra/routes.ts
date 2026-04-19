import { api } from "@leuchtturm/infra/api";
import { appDomain, zone } from "@leuchtturm/infra/dns";

new cloudflare.WorkersRoute("ApiWildcardRoute", {
	zoneId: zone.zoneId,
	pattern: `${appDomain}/api/*`,
	script: api.nodes.worker.scriptName,
});
