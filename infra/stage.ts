export const rootDomain = "leuchtturm.dev";
export const isProduction = $app.stage === "production";
export const appDomain = isProduction ? rootDomain : `${$app.stage}.${rootDomain}`;
export const zeroDomain = isProduction ? `sync.${rootDomain}` : `sync.${$app.stage}.${rootDomain}`;

export const webUrl = `https://${appDomain}`;
export const apiUrl = `${webUrl}/api`;
export const zeroUrl = `https://${zeroDomain}`;
