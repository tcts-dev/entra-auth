import {
  ConfidentialClientApplication,
  type AuthenticationResult,
} from '@azure/msal-node';
import { EXTERNAL_ID_TENANT_ID } from '../config.js';

export interface GraphClientOptions {
  clientId: string;
  clientSecret: string;
}

export interface GraphClient {
  /** Acquire an MS Graph access token (cached until near-expiry). */
  getToken(): Promise<string>;
  /** Make an authenticated call to the MS Graph API. */
  callGraph<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T>;
}

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Create an MS Graph API client backed by MSAL client credentials flow.
 *
 * Targets the Entra External ID tenant for user management operations.
 * Tokens are cached in memory and refreshed automatically near expiry.
 */
export function createGraphClient(options: GraphClientOptions): GraphClient {
  const { clientId, clientSecret } = options;

  const authority = `https://login.microsoftonline.com/${EXTERNAL_ID_TENANT_ID}`;

  const msalApp = new ConfidentialClientApplication({
    auth: { clientId, clientSecret, authority },
  });

  let cachedToken: string | null = null;
  let tokenExpiresAt = 0;

  async function getToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt - EXPIRY_BUFFER_MS) {
      return cachedToken;
    }

    let result: AuthenticationResult | null;
    try {
      result = await msalApp.acquireTokenByClientCredential({
        scopes: [GRAPH_SCOPE],
      });
    } catch (err) {
      throw new Error(
        `Graph client: failed to acquire token: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (!result?.accessToken) {
      throw new Error('Graph client: no access token returned by MSAL');
    }

    cachedToken = result.accessToken;
    tokenExpiresAt = result.expiresOn
      ? result.expiresOn.getTime()
      : Date.now() + 3_600_000;

    return cachedToken;
  }

  async function callGraph<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await getToken();
    const url = path.startsWith('https://') ? path : `${GRAPH_BASE}${path}`;

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Graph API ${method} ${path} returned ${response.status}: ${text}`,
      );
    }

    // 204 No Content — nothing to parse.
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  return { getToken, callGraph };
}
