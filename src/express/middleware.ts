import { validateToken, extractBearerToken } from '../validate-token.js';
import type { AuthUser } from '../types.js';

/**
 * Minimal Express-compatible type shapes.
 * Defined inline so `express` is NOT a hard dependency of this package.
 */
export interface EntraRequest {
  headers: { authorization?: string; [key: string]: string | string[] | undefined };
  user?: AuthUser;
  [key: string]: unknown;
}

export interface EntraResponse {
  status(code: number): EntraResponse;
  json(body: unknown): void;
}

export type NextFn = (err?: unknown) => void;
export type ExpressMiddleware = (
  req: EntraRequest,
  res: EntraResponse,
  next: NextFn,
) => void | Promise<void>;

/**
 * Express middleware that validates a Bearer token from the Authorization header.
 *
 * On success, attaches the decoded `AuthUser` to `req.user` and calls `next()`.
 * On failure, responds 401 with a JSON error body.
 *
 * @param audience - The expected `aud` claim value (typically your client ID or API URI).
 */
export function expressAuthMiddleware(audience: string): ExpressMiddleware {
  return async function entraAuthMiddleware(
    req: EntraRequest,
    res: EntraResponse,
    next: NextFn,
  ): Promise<void> {
    const authHeader = req.headers.authorization ?? null;
    const token = extractBearerToken(authHeader);

    if (!token) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    try {
      const payload = await validateToken(token, audience);

      req.user = {
        id: typeof payload.sub === 'string' ? payload.sub : '',
        entraObjectId: typeof payload.oid === 'string' ? payload.oid : '',
        email: typeof payload.email === 'string' ? payload.email : '',
        name: typeof payload.name === 'string' ? payload.name : '',
        roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
        tenants: [],
      };

      next();
    } catch (err) {
      res.status(401).json({
        error: 'Invalid or expired token',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };
}

/**
 * Express middleware that enforces a role requirement.
 *
 * Must be used AFTER `expressAuthMiddleware` (which populates `req.user`).
 * Responds 403 if the authenticated user does not have the required role.
 *
 * @param role - The role string that must appear in `req.user.roles`.
 */
export function expressRequireRole(role: string): ExpressMiddleware {
  return function entraRequireRole(
    req: EntraRequest,
    res: EntraResponse,
    next: NextFn,
  ): void {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    if (!req.user.roles.includes(role)) {
      res.status(403).json({ error: `Forbidden: role '${role}' required` });
      return;
    }

    next();
  };
}
