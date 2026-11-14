# ADR 0002: Server-Side Sessions

Status: accepted. Date: 2026-11-14.

## Context

Sign-in used two signed tokens and stored nothing on the server. A 15-minute access token stayed in memory, and a 7-day refresh token sat in an httpOnly cookie. Signing out only deleted the cookie in that browser. A copy of the cookie, taken from a shared computer or leaked any other way, kept working until it expired. One device could not be signed out on its own. A password reset or deactivation stopped renewal, but the current access token kept working for up to 15 minutes.

## Decision

Keep one row per signed-in browser in a `sessions` table.

- Both tokens name their session (`sid`). The refresh token also carries a one-time id (`jti`). The server stores only that id's SHA-256 hash, never a token.
- **Every API request checks the session.** If it has been ended or has expired, the request is refused. Signing out therefore stops the access token at once, not after 15 minutes.
- **Each renewal swaps the one-time id.** If an id that was already swapped comes back, someone is replaying an old cookie, and the whole session ends. The id swapped just before is still accepted for 30 seconds, so two tabs renewing at the same moment do not sign each other out.
- **Limits:** a session ends after `JWT_REFRESH_EXPIRY` (default 7 days) without use, and always `SESSION_MAX_AGE` (default 30 days) after sign-in. Each person keeps at most 20 sessions; beyond that the oldest is ended.
- **What ends a session:** signing out, signing out a device from *Your account*, an administrator's *Sign out everywhere*, a password reset (which keeps the device of someone resetting their own password), deactivation, or a replayed refresh token.
- Ended and expired sessions are deleted after 30 days.
- The refresh cookie's path is now `/api/auth`, so the logout route receives it and can end the session. The cookie on the old path, `/api/auth/refresh`, is cleared whenever a new cookie is set.

## Consequences

- Every authenticated request costs one extra primary-key lookup. The role lookup already costs one query per request, so lite mode stays within budget.
- Tokens issued before this change name no session, so everyone signs in once more after upgrading.
- `User.sessionVersion` is still raised on a password reset or deactivation, but nothing checks it any more. The sessions table does that work now.
- In scale mode, the check reads the shared database, so a session ended on one API instance is refused by all of them straight away.
