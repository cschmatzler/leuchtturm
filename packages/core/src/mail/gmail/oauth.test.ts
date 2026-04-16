import { describe, expect, it } from "vite-plus/test";

import { buildGoogleOAuthUrl } from "@leuchtturm/core/mail/gmail/oauth";

describe("gmail oauth url", () => {
	it("includes offline access with granted scopes and always requests consent + account selection", () => {
		const url = buildGoogleOAuthUrl({
			clientId: "client-id",
			redirectUri: "https://example.com/mail/callback",
			state: "mos_test",
		});
		const parsed = new URL(url);

		expect(parsed.origin).toBe("https://accounts.google.com");
		expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
		expect(parsed.searchParams.get("client_id")).toBe("client-id");
		expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/mail/callback");
		expect(parsed.searchParams.get("access_type")).toBe("offline");
		expect(parsed.searchParams.get("include_granted_scopes")).toBe("true");
		expect(parsed.searchParams.get("prompt")).toBe("consent select_account");
	});
});
