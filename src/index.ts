// Core types
export type {
  AuthUser,
  TenantAssignment,
  TokenPayload,
  AuthConfig,
  UsageReport,
} from './types.js';

// Configuration constants and helpers
export {
  EXTERNAL_ID_TENANT_ID,
  ISSUER,
  JWKS_URI,
  WELL_KNOWN,
  getConfig,
} from './config.js';

// Token validation
export { validateToken, extractBearerToken } from './validate-token.js';

// Next.js helpers
export { createAuthConfig } from './nextjs/auth-config.js';
export type { AuthConfigOptions } from './nextjs/auth-config.js';

export {
  setAuthFunction,
  getServerUser,
  requireAuth,
  requireRole,
} from './nextjs/server.js';

export { createAuthMiddleware } from './nextjs/middleware.js';
export type { AuthMiddlewareOptions } from './nextjs/middleware.js';

// Express helpers
export {
  expressAuthMiddleware,
  expressRequireRole,
} from './express/middleware.js';
export type {
  EntraRequest,
  EntraResponse,
  NextFn,
  ExpressMiddleware,
} from './express/middleware.js';

export { getServiceToken } from './express/client-creds.js';
export type { ClientCredentialsOptions } from './express/client-creds.js';

// MS Graph helpers
export { createGraphClient } from './graph/client.js';
export type { GraphClient, GraphClientOptions } from './graph/client.js';

export {
  listUsers,
  getUserById,
  createUser,
  disableUser,
  enableUser,
} from './graph/user-management.js';
export type {
  ExternalIdUser,
  UserIdentity,
} from './graph/user-management.js';
