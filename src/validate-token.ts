import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ISSUER, JWKS_URI } from './config.js';
import type { TokenPayload } from './types.js';

// Cached JWKS client — createRemoteJWKSet handles its own internal caching.
const jwks = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * Validate a JWT from Entra External ID.
 *
 * Verifies the signature against the tenant's JWKS, validates the issuer,
 * and validates the audience. Returns the typed token payload.
 *
 * Throws if the token is invalid, expired, or fails any claim check.
 */
export async function validateToken(
  token: string,
  audience: string,
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience,
  });

  return payload as unknown as TokenPayload;
}

/**
 * Extract a bearer token from an Authorization header value.
 *
 * Returns the token string if the header is "Bearer <token>", otherwise null.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  return match?.[1] ?? null;
}
