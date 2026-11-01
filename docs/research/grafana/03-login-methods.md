# 3. Login Methods

## Results

| Method | Status | Observed result |
|---|---|---|
| Password | Tested | Session cookies set; generic 401 on failure |
| Basic auth on API | Tested | Works by default |
| Service-account token | Tested | `glsa_` prefix, 46 chars, Bearer |
| LDAP | Tested with real OpenLDAP | Login worked; user `isExternal`, label `LDAP`; role came from group mapping |
| JWT | Tested with RS256 key | Good token accepted; wrong `iss` and expired token rejected |
| Auth proxy | Tested | User auto-created from header; label `Auth Proxy` |
| Anonymous | Tested | Page access with configured org role |
| Generic OAuth | **Redirect only** | Auth-code flow with PKCE S256 |
| GitHub, GitLab, Google, Azure AD, Okta | Config only | Listed in `/api/v1/sso-settings` |
| SAML | Not tested | Paths in spec; [K] Enterprise |

## Password [O]

`POST /login` sets:
- `grafana_session`: HttpOnly, SameSite=Lax, 30 days.
- `grafana_session_expiry`: readable by JavaScript.

`Secure` is absent by default.

**Lockout tested:** seven bad attempts on a real user; afterwards the **correct password also returned 401**. Every response was the same generic message, so users get no clue that they are locked. Default is 5 attempts, by username. IP limiting is off. The same limit means anyone who knows a username can lock that person out, including admin. Unlock time was not measured.

## Sessions [O]

- `/api/user/auth-tokens` lists sessions with device, browser, OS, IP, created and last-seen times.
- The active session cannot revoke itself through this route: `Cannot revoke active user auth token`.
- Tokens rotate every 10 minutes by default.
- Cross-origin POST with a valid cookie returned **403**, so an origin check is active.

## OAuth [O]

`/login/generic_oauth` returned 302 to the provider with `client_id`, `code_challenge`, `code_challenge_method=S256`, `redirect_uri`, `response_type=code`, `scope`, `state`. HttpOnly, SameSite=Lax cookies `oauth_state` and `oauth_code_verifier` last 10 minutes.

Note: `redirect_uri` used `localhost:3000` because `root_url` was not set. A wrong `root_url` breaks real logins.

Mapping keys: `role_attribute_path`, `org_mapping`, `groups_attribute_path`, `allowed_domains`, `allowed_groups`, `team_ids`.

Providers can be edited at runtime and are stored in `sso_setting`.

## LDAP [O]

Configured by `ldap.toml`: bind account, search filter, base DN, attribute map, group-to-role mapping. Our `group_dn = "*"` gave `Editor`. `/api/admin/ldap/status` reports server health.

## JWT [O]

Token sent in a chosen header. Config: key file or JWKS, claim names, `expect_claims`, `role_attribute_path`, `auto_sign_up`. Tested role claim `Editor`, which could then create a folder.

## Auth proxy: danger [O]

Sending `X-WEBAUTH-USER: admin` directly to the server returned `isGrafanaAdmin: true` with no password. Only the optional `whitelist` limits who may send it, and our lab did not set one. If the port is reachable, anyone becomes admin. This is the expected design for that mode, but it is unsafe unless the proxy is the sole route in.

## Bad-default summary [O]

`admin/admin`, public default `secret_key`, cookie without `Secure`, HSTS and CSP off, IP lockout off.

## For Paarvix [R]

1. P1: password + TOTP, sessions list.
2. Generic OIDC with PKCE first; Google is one preset.
3. Show a clear "temporarily locked" state, and rate-limit by username + IP so attackers cannot lock out admin alone.
4. Provider settings editable in the UI, secrets write-only.
5. Allow revoking all other sessions.
6. If proxy auth is ever added: require a trusted-IP list, refuse to start without it.
