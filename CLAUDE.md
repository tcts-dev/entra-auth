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

Add to `.npmrc` in the consuming repo:

```
@tcts-dev:registry=https://npm.pkg.github.com
```

Then:

```bash
npm install @tcts-dev/entra-auth
```

## Key decisions

- **`jose`** (not `jsonwebtoken`) — works in both Node.js and Edge runtime (Next.js middleware).
- **Generic OIDC provider** for Auth.js — the built-in `MicrosoftEntraID` provider does NOT work with `ciamlogin.com`.
- **CVE-2025-29927:** Next.js middleware can be bypassed. `createAuthMiddleware` is a UX redirect layer only. Route handlers MUST call `requireAuth()` server-side.
- **`@azure/msal-node`** for client credentials — handles token caching and refresh internally.
- `next` and `next-auth` are **peer dependencies** (optional) so the package loads cleanly in non-Next.js environments.
