import { api } from "@leuchtturm/infra/api";
import { appDomain, zone } from "@leuchtturm/infra/dns";
import { web } from "@leuchtturm/infra/web";

new cloudflare.WorkersRoute("ApiWildcardRoute", {
	zoneId: zone.zoneId,
	pattern: `${appDomain}/api/*`,
	script: api.nodes.worker.scriptName,
});

new cloudflare.WorkersRoute("WebRoute", {
	zoneId: zone.zoneId,
	pattern: appDomain,
	script: web.nodes.router.nodes.worker.scriptName,
});

new cloudflare.WorkersRoute("WebWildcardRoute", {
	zoneId: zone.zoneId,
	pattern: `${appDomain}/*`,
	script: web.nodes.router.nodes.worker.scriptName,
});
