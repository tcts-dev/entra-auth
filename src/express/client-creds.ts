import {
  ConfidentialClientApplication,
  type AuthenticationResult,
} from '@azure/msal-node';
import { EXTERNAL_ID_TENANT_ID } from '../config.js';

export interface ClientCredentialsOptions {
  clientId: string;
  clientSecret: string;
  scope: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}

// Per-(clientId+scope) token cache kept in memory for the process lifetime.
const tokenCache = new Map<string, CachedToken>();

// Refresh tokens 60 seconds before they actually expire.
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Acquire a service-to-service token via the OAuth 2.0 client credentials
 * flow against the Entra External ID tenant.
 *
 * Tokens are cached in memory and reused until they are within 60 seconds of
 * expiry, at which point a new token is acquired transparently.
 */
export async function getServiceToken(
  options: ClientCredentialsOptions,
): Promise<string> {
  const { clientId, clientSecret, scope } = options;
  const cacheKey = `${clientId}::${scope}`;

  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt - EXPIRY_BUFFER_MS) {
    return cached.accessToken;
  }

  const authority = `https://login.microsoftonline.com/${EXTERNAL_ID_TENANT_ID}`;

  const app = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority,
    },
  });

  let result: AuthenticationResult | null;
  try {
    result = await app.acquireTokenByClientCredential({ scopes: [scope] });
  } catch (err) {
    throw new Error(
      `Failed to acquire service token for scope '${scope}': ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (!result?.accessToken) {
    throw new Error(`No access token returned for scope '${scope}'`);
  }

  tokenCache.set(cacheKey, {
    accessToken: result.accessToken,
    // msal-node sets expiresOn as a Date; fall back to 1 hour if missing.
    expiresAt: result.expiresOn
      ? result.expiresOn.getTime()
      : Date.now() + 3_600_000,
  });

  return result.accessToken;
}
