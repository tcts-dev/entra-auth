export interface TenantAssignment {
  tenantId: string;
  tenantSlug: string;
  role?: string;
}

export interface AuthUser {
  id: string;
  entraObjectId: string;
  email: string;
  name: string;
  roles: string[];
  tenants: TenantAssignment[];
}

export interface TokenPayload {
  /** Issuer */
  iss: string;
  /** Subject — the user's object ID in Entra */
  sub: string;
  /** Audience */
  aud: string | string[];
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Not before (Unix timestamp) */
  nbf?: number;
  /** Auth time (Unix timestamp) */
  auth_time?: number;
  /** Nonce */
  nonce?: string;
  /** Identity provider */
  idp?: string;
  /** Entra object ID */
  oid?: string;
  /** Email claim */
  email?: string;
  /** Display name */
  name?: string;
  /** Preferred username (UPN or email) */
  preferred_username?: string;
  /** Tenant ID */
  tid?: string;
  /** Roles assigned in the app registration */
  roles?: string[];
  /** Any additional claims */
  [key: string]: unknown;
}

export interface AuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  issuer?: string;
  jwksUri?: string;
}

export interface UsageReport {
  tenantId: string;
  service: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
}
