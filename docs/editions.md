# Paarvix Editions

Paarvix comes in three editions. **Community** is free and open source (AGPLv3) for ever. **Pro** and **Enterprise** add features for organisations, unlocked with a licence key from KannanTech.

The rule for what is paid: anything a person or team needs to get answers from their data is Community. Pro covers what an organisation needs once it relies on Paarvix every day: automation, accountability and its own brand. Enterprise covers what IT, security and compliance need at scale.

**A Community feature never becomes paid.** CI enforces this: `scripts/check-editions.mjs` fails the build if a feature leaves Community.

## What each edition includes

The list lives in `packages/shared/src/editions.ts`. The *Licence* page in Administration shows it with what is on for your server.

| Community (free) | Pro | Enterprise |
|---|---|---|
| All connectors, query builder, SQL editor, saved queries | Scheduled PDF and Excel reports | SAML single sign-on, SCIM, LDAP and Active Directory |
| All panels; laptop, phone and TV dashboards; templates | Alerts on WhatsApp, Telegram, Slack, Teams and SMS | Multiple organisations on one install |
| Custom roles, per-source access, **row rules** | Audit log | Embed dashboards in your own product |
| Google sign-in, sessions and signed-in devices | Dashboard version history | Send the audit log to your SIEM |
| Your logo, colours and organisation name | Full white-label | Data lineage and catalogue |
| Email alerts, AI with your own key or a local model | Premium template packs, AI insights and forecasts | High-availability cluster |
| Plugin SDK, CLI, installable app | Column hiding, row rules from a table | Priority support with an SLA |

## Licences

A licence is a signed key starting with `PVX1.`. Paarvix checks the signature against KannanTech's public key on your own server, so **no internet connection is needed** and nothing is sent anywhere.

- **Add a licence:** Administration → *Licence*, paste the key (Super Admin only). Or set `PAARVIX_LICENSE`, or `PAARVIX_LICENSE_FILE` to a file holding it; a key set this way cannot be changed from the screen.
- **Licence for one server:** send the *Server id* shown on the Licence page when you buy.
- **Expiry:** paid features keep working for 30 days after a licence expires, with a warning. Then they switch off. **Community features, your data, users and dashboards are never locked.**
- **Without a licence**, or with one that is invalid, Paarvix runs as Community.

## How the code is split (for contributors)

- This repository holds Community and the **extension points** paid modules plug into (`apps/api/src/extensions/`, `apps/web/src/app/optional-routes.ts`). It never contains paid code.
- Pro and Enterprise modules live in the private `paarvix-pro` repository and are loaded only when installed. Each paid feature also checks the licence.
- When a paid feature needs a new hook, the hook is added here first, so Community plugins can use it too.

See ADR 0003 for the reasoning. Commercial licences and quotes: support@kannantech.com.
