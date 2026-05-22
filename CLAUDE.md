# @tcts/entra-auth

Shared authentication package for TCTS services. Handles Entra External ID (CIAM) token validation, Auth.js v5 integration, Express middleware, service-to-service credentials, and MS Graph user management.

## Tenant

- **Type:** Entra External ID (CIAM)
- **Tenant ID:** `c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0`
- **Issuer:** `https://c19f4a16-2c80-4ffd-8d5f-1cd040ce55a0.ciamlogin.com/...`

## Consumers

This package is consumed by:
- **Mission Control** (`tcts-dev/mission-control`) — Next.js app, uses nextjs/ helpers
- **Porter** (`tcts-dev/porter-portal`) — Next.js app, uses nextjs/ helpers
- **Sawyer** (`tcts-dev/Sawyer`) — Express/Node, uses express/ middleware
- **TTS** (`tcts-dev/tts-service`) — Node service, uses express/ middleware or client-creds

## Install

Consumed via SHA-pinned `git+https://` in the consumer's `package.json` (not GitHub Packages — see workspace `CLAUDE.md` for why):

```json
{
  "dependencies": {
    "@tcts-dev/entra-auth": "git+https://github.com/tcts-dev/entra-auth.git#<commit-sha>"
  }
}
```

Then:

```bash
npm install
```

To pick up a new version in a consumer, bump the SHA — `npm` caches git deps aggressively.

## Key decisions

- **`jose`** (not `jsonwebtoken`) — works in both Node.js and Edge runtime (Next.js middleware).
- **Generic OIDC provider** for Auth.js — the built-in `MicrosoftEntraID` provider does NOT work with `ciamlogin.com`.
- **CVE-2025-29927:** Next.js middleware can be bypassed. `createAuthMiddleware` is a UX redirect layer only. Route handlers MUST call `requireAuth()` server-side.
- **`@azure/msal-node`** for client credentials — handles token caching and refresh internally.
- `next` and `next-auth` are **peer dependencies** (optional) so the package loads cleanly in non-Next.js environments.

## User provisioning: pick the right path

`@tcts-dev/entra-auth` exposes two ways to put a new user into the
External ID directory. They are **NOT** interchangeable. Picking the
wrong one is a real-world failure mode — `oneoff-entra-unblock` (Sawyer,
2026-05-18) shipped a user via `createUser` that blocked their SSO
entirely.

| Path | When to use | What happens |
|---|---|---|
| **`inviteB2BGuest()` (default)** | User has *any* Microsoft identity — ckscrivner.com workforce, another Entra tenant, or a personal Microsoft account | Graph `POST /invitations` → Microsoft sends invite email → user accepts → federated guest created in External ID → **SSO works**, no password to set |
| **`createUser()` (narrow)** | User has *no* Microsoft identity anywhere (outside contractor with no other email) | Graph `POST /users` with local password identity → random initial password + `forceChangePasswordNextSignIn` → user must do Forgot-Password flow → **never SSOs**, even if a workforce identity later appears |

**Default to `inviteB2BGuest()`.** Reach for `createUser()` only when
you've confirmed the user has no Microsoft identity. If you're not sure,
invite — Microsoft handles "viral tenant" creation for raw email
addresses, so an invite to a Gmail user still works.

**Graph permissions required:**
- `inviteB2BGuest()` → `User.Invite.All`
- `createUser()` → `User.ReadWrite.All` (or `Application.ReadWrite.OwnedBy` for narrow create-only)
- `listUsers()` / `getUserById()` → `User.Read.All`
