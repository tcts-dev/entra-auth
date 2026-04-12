/**
 * Next.js middleware helpers.
 *
 * ⚠️  SECURITY NOTE — CVE-2025-29927:
 *     Next.js middleware CAN BE BYPASSED by a crafted x-middleware-subrequest
 *     header. This middleware is a FIRST PASS / UX layer only (redirects
 *     unauthenticated users to the sign-in page). It is NOT a security
 *     boundary. Route handlers and server components MUST independently call
 *     requireAuth() / requireRole() from @tcts/entra-auth/nextjs/server.
 */

export interface AuthMiddlewareOptions {
  /**
   * Paths that do not require authentication. Supports exact matches and
   * simple prefix patterns ending with `*`, e.g. '/api/public/*'.
   */
  publicPaths?: string[];
}

// Minimal Next.js type shapes so this file has no hard dependency on 'next'.
interface MinimalRequest {
  nextUrl: { pathname: string };
  url: string;
  auth?: { user?: unknown } | null;
}

type MiddlewareFn = (request: MinimalRequest) => Response | null | undefined | Promise<Response | null | undefined>;

/**
 * Determine whether a pathname matches any of the given public path patterns.
 * Patterns ending with `*` are treated as prefix matches.
 */
function isPublicPath(pathname: string, publicPaths: string[]): boolean {
  return publicPaths.some((pattern) => {
    if (pattern.endsWith('*')) {
      return pathname.startsWith(pattern.slice(0, -1));
    }
    return pathname === pattern;
  });
}

/**
 * Create a Next.js middleware function that redirects unauthenticated users
 * to the sign-in page for all non-public paths.
 *
 * This middleware is designed to be wrapped by Auth.js v5's `auth()` helper,
 * which attaches the session to `request.auth` before calling the handler.
 *
 * @example
 * // middleware.ts
 * import NextAuth from 'next-auth';
 * import { authConfig } from './auth.config';
 * import { createAuthMiddleware } from '@tcts/entra-auth/nextjs/middleware';
 *
 * const { auth } = NextAuth(authConfig);
 * export default auth(createAuthMiddleware({ publicPaths: ['/', '/api/health'] }));
 * export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
 */
export function createAuthMiddleware(
  options: AuthMiddlewareOptions = {},
): MiddlewareFn {
  const { publicPaths = [] } = options;

  // These are always public regardless of caller config.
  const defaultPublic = [
    '/api/auth/*',
    '/_next/*',
    '/favicon.ico',
    '/sign-in',
  ];
  const allPublic = [...defaultPublic, ...publicPaths];

  return (request: MinimalRequest): Response | null | undefined => {
    const { pathname } = request.nextUrl;

    // Let public paths through unconditionally.
    if (isPublicPath(pathname, allPublic)) {
      return undefined; // next()
    }

    // Auth.js v5 attaches the session to request.auth.
    const isAuthenticated = Boolean(request.auth?.user);
    if (isAuthenticated) {
      return undefined; // next()
    }

    // Redirect unauthenticated users to sign-in.
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', request.url);
    return Response.redirect(signInUrl.toString(), 302);
  };
}
