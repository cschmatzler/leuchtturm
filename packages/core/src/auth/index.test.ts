import { describe, expect, it } from "vite-plus/test";

import { deriveCrossSubDomainCookieDomain } from "@chevrotain/core/auth/index";

describe("deriveCrossSubDomainCookieDomain", () => {
	it("derives the shared parent domain for sibling subdomains", () => {
		expect(
			deriveCrossSubDomainCookieDomain(
				"https://app.chevrotain.schmatzler.com",
				"https://api.chevrotain.schmatzler.com",
			),
		).toBe("chevrotain.schmatzler.com");
	});

	it("uses the apex host when only one URL is on a subdomain", () => {
		expect(
			deriveCrossSubDomainCookieDomain(
				"https://chevrotain.schmatzler.com",
				"https://api.chevrotain.schmatzler.com",
			),
		).toBe("chevrotain.schmatzler.com");
	});

	it("disables cross-subdomain cookies when both URLs use the same host", () => {
		expect(
			deriveCrossSubDomainCookieDomain(
				"https://app.chevrotain.schmatzler.com",
				"https://app.chevrotain.schmatzler.com",
			),
		).toBeNull();
	});

	it("disables cross-subdomain cookies for localhost", () => {
		expect(
			deriveCrossSubDomainCookieDomain("http://localhost:3000", "http://localhost:8787"),
		).toBeNull();
	});
});
