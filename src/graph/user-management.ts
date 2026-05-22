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
 * Invite an external user as a B2B guest in the Entra External ID tenant.
 *
 * Unlike `createUser`, which creates a LOCAL email+password account that
 * Entra resolves *before* trying federation (and therefore blocks SSO from
 * any federated workforce tenant), this function uses Graph's
 * `/invitations` endpoint to create a FEDERATED guest. Microsoft sends the
 * invitation email; on acceptance, the user's home-tenant identity (e.g.
 * their `ckscrivner.com` workforce account or a personal Microsoft
 * account) gets linked into the External ID directory and SSO works.
 *
 * **Use this** for any user whose email belongs to:
 *   - A federated workforce Entra tenant
 *   - A personal Microsoft account (`outlook.com`, `hotmail.com`, etc.)
 *   - Another Entra / Azure AD tenant
 *
 * **Use `createUser`** only for users who genuinely have no Microsoft
 * identity anywhere (rare — outside contractors with no other email).
 * That path requires the user to complete a Forgot-Password flow on first
 * sign-in, which is a real UX gap.
 *
 * **Required Graph permission:** `User.Invite.All` (application or
 * delegated). If the app registration is missing this consent, the call
 * fails with 403 `Authorization_RequestDenied`.
 *
 * @see https://learn.microsoft.com/en-us/graph/api/invitation-post
 */
export interface InviteB2BGuestParams {
  /** External email the invitation gets sent to. */
  email: string;
  /** Display name shown in the External ID directory. */
  displayName: string;
  /**
   * Post-acceptance landing URL — where the user is redirected after
   * accepting the invite. Typically the consumer app's sign-in page
   * (e.g. `https://sawyer.tcts.network`).
   */
  inviteRedirectUrl: string;
  /**
   * Whether Microsoft should send the invitation email automatically.
   * Defaults to `true`. Set to `false` if the consumer app wants to
   * handle delivery itself using the `inviteRedeemUrl` returned in the
   * response (e.g. embed it in a custom HTML email).
   */
  sendInvitationMessage?: boolean;
  /**
   * Optional custom message body shown in the Microsoft invitation
   * email. Ignored when `sendInvitationMessage` is `false`.
   */
  messageBody?: string;
}

export interface InvitationResponse {
  /** GUID of the invitation object itself (not the invited user). */
  id: string;
  /**
   * The Microsoft redeem URL — share this if `sendInvitationMessage`
   * was `false` and you're handling email delivery yourself.
   */
  inviteRedeemUrl: string;
  invitedUserDisplayName: string;
  invitedUserEmailAddress: string;
  /** The User object Microsoft created for the invitee in the directory. */
  invitedUser: { id: string; displayName?: string };
  sendInvitationMessage: boolean;
  /** Typically `"PendingAcceptance"` on creation. */
  status: string;
}

export async function inviteB2BGuest(
  client: GraphClient,
  params: InviteB2BGuestParams,
): Promise<InvitationResponse> {
  const {
    email,
    displayName,
    inviteRedirectUrl,
    sendInvitationMessage = true,
    messageBody,
  } = params;

  const body: Record<string, unknown> = {
    invitedUserEmailAddress: email,
    invitedUserDisplayName: displayName,
    inviteRedirectUrl,
    sendInvitationMessage,
  };

  // Only attach the message-info block when there's something to say
  // — sending an empty `invitedUserMessageInfo` object causes the
  // default Microsoft template not to render the custom-message slot.
  if (sendInvitationMessage && messageBody) {
    body.invitedUserMessageInfo = {
      messageLanguage: 'en-US',
      customizedMessageBody: messageBody,
    };
  }

  return client.callGraph<InvitationResponse>('POST', '/invitations', body);
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
