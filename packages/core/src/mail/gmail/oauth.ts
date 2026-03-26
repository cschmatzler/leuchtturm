/**
 * Gmail OAuth2 service.
 *
 * Encapsulates the OAuth2 flow: URL generation and code-for-token exchange.
 * Config is resolved at layer construction time so handlers stay pure Effect.
 */

import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";

const GMAIL_SCOPES = [
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export interface OAuthTokens {
	readonly accessToken: string;
	readonly refreshToken?: string;
	readonly expiresIn: number;
}

export interface GoogleUserInfo {
	readonly email: string;
	readonly name?: string;
}

export namespace GmailOAuth {
	export interface Interface {
		readonly getAuthUrl: () => string;
		readonly exchangeCode: (code: string) => Promise<OAuthTokens>;
		readonly getUserInfo: (accessToken: string) => Promise<GoogleUserInfo>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/GmailOAuth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const clientId = yield* Config.string("GMAIL_OAUTH_CLIENT_ID");
			const clientSecret = yield* Config.redacted("GMAIL_OAUTH_CLIENT_SECRET");
			const redirectUri = yield* Config.string("GMAIL_OAUTH_REDIRECT_URI");

			return Service.of({
				getAuthUrl() {
					const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
					url.searchParams.set("client_id", clientId);
					url.searchParams.set("redirect_uri", redirectUri);
					url.searchParams.set("response_type", "code");
					url.searchParams.set("scope", GMAIL_SCOPES);
					url.searchParams.set("access_type", "offline");
					url.searchParams.set("prompt", "consent");
					return url.toString();
				},

				async exchangeCode(code: string) {
					const res = await fetch("https://oauth2.googleapis.com/token", {
						method: "POST",
						headers: { "Content-Type": "application/x-www-form-urlencoded" },
						body: new URLSearchParams({
							code,
							client_id: clientId,
							client_secret: Redacted.value(clientSecret),
							redirect_uri: redirectUri,
							grant_type: "authorization_code",
						}),
					});
					if (!res.ok) {
						const body = await res.text();
						throw new Error(`OAuth token exchange failed: ${body}`);
					}
					const data = (await res.json()) as {
						access_token: string;
						refresh_token?: string;
						expires_in: number;
					};
					return {
						accessToken: data.access_token,
						refreshToken: data.refresh_token,
						expiresIn: data.expires_in,
					};
				},

				async getUserInfo(accessToken: string) {
					const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
						headers: { Authorization: `Bearer ${accessToken}` },
					});
					if (!res.ok) throw new Error("Failed to fetch Google user info");
					const data = (await res.json()) as { email: string; name?: string };
					return { email: data.email, name: data.name };
				},
			});
		}),
	);

	export const defaultLayer = layer;
}
