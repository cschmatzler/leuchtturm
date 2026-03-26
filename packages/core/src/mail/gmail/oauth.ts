/**
 * Gmail OAuth2 service.
 *
 * Encapsulates the OAuth2 flow: URL generation and code-for-token exchange.
 * Config is resolved at layer construction time so handlers stay pure Effect.
 */

import { Config, Effect, Layer, Redacted, ServiceMap } from "effect";

const GMAIL_SCOPES = [
	"https://www.googleapis.com/auth/gmail.readonly",
	"https://www.googleapis.com/auth/gmail.labels",
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
		readonly getAuthUrl: (state: string) => string;
		readonly exchangeCode: (code: string) => Promise<OAuthTokens>;
		readonly refreshAccessToken: (refreshToken: string) => Promise<OAuthTokens>;
		readonly getUserInfo: (accessToken: string) => Promise<GoogleUserInfo>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@chevrotain/GmailOAuth") {}

	export const layer = Layer.effect(Service)(
		Effect.gen(function* () {
			const clientId = yield* Config.string("GMAIL_OAUTH_CLIENT_ID");
			const clientSecret = yield* Config.redacted("GMAIL_OAUTH_CLIENT_SECRET");
			const redirectUri = yield* Config.string("GMAIL_OAUTH_REDIRECT_URI");

			async function exchangeToken(body: URLSearchParams): Promise<OAuthTokens> {
				const res = await fetch("https://oauth2.googleapis.com/token", {
					method: "POST",
					headers: { "Content-Type": "application/x-www-form-urlencoded" },
					body,
				});
				if (!res.ok) {
					const responseBody = await res.text();
					throw new Error(`OAuth token exchange failed: ${responseBody}`);
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
			}

			return Service.of({
				getAuthUrl(state) {
					const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
					url.searchParams.set("client_id", clientId);
					url.searchParams.set("redirect_uri", redirectUri);
					url.searchParams.set("response_type", "code");
					url.searchParams.set("scope", GMAIL_SCOPES);
					url.searchParams.set("access_type", "offline");
					url.searchParams.set("prompt", "consent");
					url.searchParams.set("state", state);
					return url.toString();
				},

				async exchangeCode(code: string) {
					return exchangeToken(
						new URLSearchParams({
							code,
							client_id: clientId,
							client_secret: Redacted.value(clientSecret),
							redirect_uri: redirectUri,
							grant_type: "authorization_code",
						}),
					);
				},

				async refreshAccessToken(refreshToken: string) {
					return exchangeToken(
						new URLSearchParams({
							client_id: clientId,
							client_secret: Redacted.value(clientSecret),
							refresh_token: refreshToken,
							grant_type: "refresh_token",
						}),
					);
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
