import { Polar } from "@polar-sh/sdk";

import { coreBillingConfig } from "@chevrotain/core/config";

export const POLAR_ACCESS_TOKEN = coreBillingConfig.accessToken;
export const POLAR_SUCCESS_URL = coreBillingConfig.successUrl;
export const POLAR_WEBHOOK_SECRET = coreBillingConfig.webhookSecret;

export const polarClient = new Polar({
	accessToken: POLAR_ACCESS_TOKEN,
	server: "sandbox",
});
