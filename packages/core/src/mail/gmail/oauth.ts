import { Effect, Layer, Redacted, Schema, ServiceMap } from "effect";
import { Resource } from "sst";

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
	export class GmailOAuthError extends Schema.TaggedErrorClass<GmailOAuthError>()(
		"GmailOAuthError",
		{ message: Schema.String },
		{ httpApiStatus: 500 },
	) {}

	export interface Interface {
		readonly getAuthUrl: (state: string) => Effect.Effect<string, GmailOAuthError>;
		readonly exchangeCode: (code: string) => Effect.Effect<OAuthTokens, GmailOAuthError>;
		readonly refreshAccessToken: (
			refreshToken: string,
		) => Effect.Effect<OAuthTokens, GmailOAuthError>;
		readonly getUserInfo: (accessToken: string) => Effect.Effect<GoogleUserInfo, GmailOAuthError>;
	}

	export class Service extends ServiceMap.Service<Service, Interface>()("@leuchtturm/GmailOAuth") {}

	export const layer = Layer.effect(Service)(
		Effect.sync(() => {
			const clientId = Resource.GmailOauthClientId.value;
			const clientSecret = Redacted.make(Resource.GmailOauthClientSecret.value);
			const redirectUri = Resource.GmailOauthRedirectUri.value;

			const exchangeToken = Effect.fn("GmailOAuth.exchangeToken")(function* (
				body: URLSearchParams,
			) {
				return yield* Effect.tryPromise({
					try: async () => {
						const response = await fetch("https://oauth2.googleapis.com/token", {
							method: "POST",
							headers: { "Content-Type": "application/x-www-form-urlencoded" },
							body,
						});
						if (!response.ok) {
							const responseBody = await response.text();
							throw new Error(`OAuth token exchange failed: ${responseBody}`);
						}

						const data = (await response.json()) as {
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
					catch: (error) =>
						new GmailOAuthError({
							message: String(error),
						}),
				});
			});

			const getAuthUrl = (state: string) =>
				Effect.sync(() => {
					const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
					url.searchParams.set("client_id", clientId);
					url.searchParams.set("redirect_uri", redirectUri);
					url.searchParams.set("response_type", "code");
					url.searchParams.set("scope", GMAIL_SCOPES);
					url.searchParams.set("access_type", "offline");
					url.searchParams.set("prompt", "consent");
					url.searchParams.set("state", state);
					return url.toString();
				});

			const exchangeCode = Effect.fn("GmailOAuth.exchangeCode")(function* (code: string) {
				return yield* exchangeToken(
					new URLSearchParams({
						code,
						client_id: clientId,
						client_secret: Redacted.value(clientSecret),
						redirect_uri: redirectUri,
						grant_type: "authorization_code",
					}),
				);
			});

			const refreshAccessToken = Effect.fn("GmailOAuth.refreshAccessToken")(function* (
				refreshToken: string,
			) {
				return yield* exchangeToken(
					new URLSearchParams({
						client_id: clientId,
						client_secret: Redacted.value(clientSecret),
						refresh_token: refreshToken,
						grant_type: "refresh_token",
					}),
				);
			});

			const getUserInfo = Effect.fn("GmailOAuth.getUserInfo")(function* (accessToken: string) {
				const data = yield* Effect.tryPromise({
					try: async () => {
						const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
							headers: { Authorization: `Bearer ${accessToken}` },
						});
						if (!response.ok) {
							const responseBody = await response.text();
							throw new Error(`Failed to fetch Google user info: ${responseBody}`);
						}

						return (await response.json()) as { email: string; name?: string };
					},
					catch: (error) =>
						new GmailOAuthError({
							message: String(error),
						}),
				});

				return { email: data.email, name: data.name };
			});

			return Service.of({
				getAuthUrl,
				exchangeCode,
				refreshAccessToken,
				getUserInfo,
			});
		}),
	);

	export const defaultLayer = layer;
}
