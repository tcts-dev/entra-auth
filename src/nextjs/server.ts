/**
 * Server-side auth helpers for Next.js App Router.
 *
 * These helpers wrap Auth.js v5's `auth()` function. They must be used in
 * Server Components, Route Handlers, or Server Actions — NOT in middleware.
 *
 * ⚠️  CVE-2025-29927: Next.js middleware can be bypassed at the HTTP layer.
 *     Middleware is a FIRST PASS only. Route handlers and server components
 *     MUST call requireAuth() or requireRole() themselves.
 */

import type { AuthUser } from '../types.js';

// Auth.js v5 is a peer dependency — import lazily so the package can be loaded
// without it in non-Next.js environments.
type AuthFunction = () => Promise<{ user?: Partial<AuthUser> } | null>;

let _auth: AuthFunction | null = null;

/**
 * Register the Auth.js `auth` function. Call this once at app startup, e.g.
 * in your `auth.ts` file:
 *
 *   import { setAuthFunction } from '@tcts/entra-auth/nextjs/server';
 *   import { auth } from './auth';   // your NextAuth instance
 *   setAuthFunction(auth);
 */
export function setAuthFunction(authFn: AuthFunction): void {
  _auth = authFn;
}

function getAuth(): AuthFunction {
  if (!_auth) {
    throw new Error(
      '@tcts/entra-auth: auth function not registered. Call setAuthFunction(auth) during app initialization.',
    );
  }
  return _auth;
}

/**
 * Return the current authenticated user, or null if the request is
 * unauthenticated. Safe to call in Server Components and Route Handlers.
 */
export async function getServerUser(): Promise<AuthUser | null> {
  const auth = getAuth();
  const session = await auth();
  if (!session?.user) return null;

  const u = session.user;
  return {
    id: u.id ?? '',
    entraObjectId: u.entraObjectId ?? '',
    email: u.email ?? '',
    name: u.name ?? '',
    roles: Array.isArray(u.roles) ? (u.roles as string[]) : [],
    tenants: Array.isArray(u.tenants) ? (u.tenants as AuthUser['tenants']) : [],
  };
}

/**
 * Require an authenticated user. Throws a 401 Response if the request is
 * unauthenticated. Use in API Route Handlers.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getServerUser();
  if (!user) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return user;
}

/**
 * Require an authenticated user with the given role. Throws 401 if
 * unauthenticated, 403 if the role is missing.
 */
export async function requireRole(role: string): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.roles.includes(role)) {
    throw new Response(`Forbidden: role '${role}' required`, { status: 403 });
  }
  return user;
}
