import type { AuthConfig } from './types.js';

export const EXTERNAL_ID_TENANT_ID = 'c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0';

export const ISSUER =
  'https://c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0.ciamlogin.com/c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0/v2.0';

export const JWKS_URI =
  'https://c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0.ciamlogin.com/c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0/discovery/v2.0/keys';

export const WELL_KNOWN = `${ISSUER}/.well-known/openid-configuration`;

/**
 * Build an AuthConfig from environment variables, with optional overrides.
 *
 * Reads:
 *   ENTRA_TENANT_ID   (defaults to EXTERNAL_ID_TENANT_ID)
 *   ENTRA_CLIENT_ID
 *   ENTRA_CLIENT_SECRET
 */
export function getConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  const tenantId =
    overrides?.tenantId ?? process.env['ENTRA_TENANT_ID'] ?? EXTERNAL_ID_TENANT_ID;

  const clientId = overrides?.clientId ?? process.env['ENTRA_CLIENT_ID'] ?? '';
  const clientSecret =
    overrides?.clientSecret ?? process.env['ENTRA_CLIENT_SECRET'] ?? '';

  if (!clientId) {
    throw new Error('ENTRA_CLIENT_ID is required (env var or override)');
  }
  if (!clientSecret) {
    throw new Error('ENTRA_CLIENT_SECRET is required (env var or override)');
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    issuer: overrides?.issuer ?? ISSUER,
    jwksUri: overrides?.jwksUri ?? JWKS_URI,
  };
}
