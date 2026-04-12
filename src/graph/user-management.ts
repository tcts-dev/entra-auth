import type { GraphClient } from './client.js';

export interface ExternalIdUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  accountEnabled: boolean;
  identities: UserIdentity[];
  createdDateTime?: string;
}

export interface UserIdentity {
  signInType: string;
  issuer: string;
  issuerAssignedId: string;
}

interface GraphListResponse<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

const USER_SELECT =
  'id,displayName,mail,userPrincipalName,accountEnabled,identities,createdDateTime';

/**
 * List all users in the External ID tenant.
 *
 * Follows @odata.nextLink pages automatically, so it always returns the full
 * set regardless of tenant size.
 */
export async function listUsers(client: GraphClient): Promise<ExternalIdUser[]> {
  const users: ExternalIdUser[] = [];
  let url: string | undefined = `/users?$select=${USER_SELECT}&$top=100`;

  while (url) {
    const currentUrl: string = url;
    const page: GraphListResponse<ExternalIdUser> =
      await client.callGraph<GraphListResponse<ExternalIdUser>>('GET', currentUrl);
    users.push(...page.value);
    url = page['@odata.nextLink'];
  }

  return users;
}

/**
 * Get a single user by their Entra object ID.
 */
export async function getUserById(
  client: GraphClient,
  userId: string,
): Promise<ExternalIdUser> {
  return client.callGraph<ExternalIdUser>(
    'GET',
    `/users/${encodeURIComponent(userId)}?$select=${USER_SELECT}`,
  );
}

/**
 * Create a new user in the External ID tenant.
 *
 * The user is created with a local email+password identity so they can sign in
 * via the External ID user flow. A random password is generated — the user
 * should be prompted to reset it on first login or use a password-reset flow.
 */
export async function createUser(
  client: GraphClient,
  params: { email: string; displayName: string },
): Promise<ExternalIdUser> {
  const { email, displayName } = params;

  const body = {
    displayName,
    mail: email,
    accountEnabled: true,
    identities: [
      {
        signInType: 'emailAddress',
        issuer: 'tcts.onmicrosoft.com',
        issuerAssignedId: email,
      },
    ],
    passwordProfile: {
      // Random initial password. Users must go through password-reset flow.
      password: generateInitialPassword(),
      forceChangePasswordNextSignIn: true,
    },
    passwordPolicies: 'DisablePasswordExpiration',
  };

  return client.callGraph<ExternalIdUser>('POST', '/users', body);
}

/**
 * Disable a user's account (soft delete / suspend).
 */
export async function disableUser(
  client: GraphClient,
  userId: string,
): Promise<void> {
  await client.callGraph<void>(
    'PATCH',
    `/users/${encodeURIComponent(userId)}`,
    { accountEnabled: false },
  );
}

/**
 * Re-enable a previously disabled user account.
 */
export async function enableUser(
  client: GraphClient,
  userId: string,
): Promise<void> {
  await client.callGraph<void>(
    'PATCH',
    `/users/${encodeURIComponent(userId)}`,
    { accountEnabled: true },
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Generate a random initial password that satisfies Entra's complexity rules:
 * at least 8 chars, upper + lower + digit + symbol.
 */
function generateInitialPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  const rand = (chars: string): string =>
    chars[Math.floor(Math.random() * chars.length)] ?? chars[0];

  const required = [rand(upper), rand(lower), rand(digits), rand(symbols)];
  const extra = Array.from({ length: 8 }, () => rand(all));
  const password = [...required, ...extra]
    .sort(() => Math.random() - 0.5)
    .join('');

  return password;
}
