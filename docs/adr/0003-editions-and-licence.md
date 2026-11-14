# ADR 0003: Editions, Licence Keys and the Open-Core Split

Status: accepted. Date: 2026-11-14.

## Context

Paarvix needs a generous free edition, so it can spread, and paid editions, so it can be funded. Features built so far sat behind "open gates" until the split was decided before the first release.

## Decision

- **Three editions**, listed feature by feature in `packages/shared/src/editions.ts`: Community, Pro and Enterprise. A Community feature is free for ever. Custom roles, per-source access, theme and row rules are Community.
- **Licence keys** are Ed25519-signed JSON (brief §9.1) in the form `PVX1.<payload>.<signature>`. The public key ships in the app (`apps/api/src/license/public-key.ts`). The private key is kept offline, outside every repository. Checking happens entirely on the customer's server.
- **States:** none (Community), active, grace (30 days after expiry, with paid features still on), expired (paid features off), invalid (treated as Community). No state ever locks data or Community features.
- **Two repositories.** The public repository holds Community plus extension points. Pro and Enterprise share one private `paarvix-pro` repository and one image; the licence decides what is on.
- **Extension points:** core asks for tokens such as `AUDIT_SINK` and gets Community defaults. `loadOptionalModules()` imports `@paarvix-pro/api` only if it is installed. The web app reads `OPTIONAL_ROUTES`, which is empty in the public repository.
- **CI guard** (`scripts/check-editions.mjs`): fails if a feature in `scripts/community-features.json` stops being Community, if anything but the loader refers to `@paarvix-pro`, or if the public optional routes are not empty.

## Consequences

- Paid code can be developed and released without touching core files; new hooks land in the public repository first.
- A determined user can patch AGPL code to bypass the check. That is accepted: the licence protects honest organisations' compliance, and support and updates are what they buy.
- Losing the private signing key means new licences cannot be issued for existing installs. It must be backed up offline.
