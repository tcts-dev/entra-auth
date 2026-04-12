import { ISSUER } from '../config.js';

export interface AuthConfigOptions {
  clientId: string;
  clientSecret: string;
  // Auth.js callback types vary by version — keep loose here, strict at call site.
  callbacks?: Record<string, (...args: unknown[]) => unknown>;
}

/**
 * Build an Auth.js v5 configuration object for Entra External ID.
 *
 * Auth.js's built-in MicrosoftEntraID provider does NOT work with ciamlogin.com,
 * so we use the generic OIDC provider with an explicit issuer.
 */
export function createAuthConfig(options: AuthConfigOptions): Record<string, unknown> {
  const { clientId, clientSecret, callbacks } = options;

  return {
    providers: [
      {
        id: 'entra-external',
        name: 'TCTS Login',
        type: 'oidc',
        issuer: ISSUER,
        clientId,
        clientSecret,
        authorization: {
          params: {
            scope: 'openid profile email offline_access',
          },
        },
      },
    ],
    callbacks: {
      /**
       * Persist Entra-specific claims (oid, email, name) into the JWT token
       * so they survive across requests without needing another /userinfo call.
       */
      jwt({
        token,
        profile,
      }: {
        token: Record<string, unknown>;
        profile?: Record<string, unknown>;
        [key: string]: unknown;
      }): Record<string, unknown> {
        if (profile) {
          if (profile['oid'] !== undefined) token['oid'] = profile['oid'];
          if (profile['email'] !== undefined) token['email'] = profile['email'];
          if (profile['name'] !== undefined) token['name'] = profile['name'];
          if (profile['roles'] !== undefined) token['roles'] = profile['roles'];
          if (profile['tid'] !== undefined) token['tid'] = profile['tid'];
        }
        return token;
      },

      /**
       * Expose the user data stored in the JWT to the client-side session.
       */
      session({
        session,
        token,
      }: {
        session: Record<string, unknown>;
        token: Record<string, unknown>;
        [key: string]: unknown;
      }): Record<string, unknown> {
        const user = (session['user'] as Record<string, unknown> | undefined) ?? {};
        if (token['oid'] !== undefined) user['entraObjectId'] = token['oid'];
        if (token['email'] !== undefined) user['email'] = token['email'];
        if (token['name'] !== undefined) user['name'] = token['name'];
        if (token['roles'] !== undefined) user['roles'] = token['roles'];
        if (token['sub'] !== undefined) user['id'] = token['sub'];
        session['user'] = user;
        return session;
      },

      // Spread caller-supplied overrides last so they take precedence.
      ...callbacks,
    },
  };
}
