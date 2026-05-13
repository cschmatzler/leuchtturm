import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

export namespace DocsHandler {
	export const html = `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>Leuchtturm API</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
	</head>
	<body>
		<div id="scalar-api-reference"></div>
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference/dist/browser/standalone.min.js" crossorigin></script>
		<script>
			Scalar.createApiReference("#scalar-api-reference", ${JSON.stringify({
				_integration: "html",
				sources: [
					{
						title: "Leuchtturm",
						slug: "leuchtturm",
						url: "/open-api",
						default: true,
					},
					{
						title: "Better Auth",
						slug: "auth",
						url: "/auth/open-api/generate-schema",
					},
				],
			})});
		</script>
	</body>
</html>`;

	export const layer = HttpRouter.add("GET", "/docs", HttpServerResponse.html(html));
}
