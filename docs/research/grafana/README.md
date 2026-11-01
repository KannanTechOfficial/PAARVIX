# Grafana Deep Research

Hands-on study of **Grafana OSS 13.0.2** (commit `3fcdbc5a`), 2026-11-01. The home page of that build linked a 13.3 release post, so newer behaviour may differ.

**Clean-room rule:** ideas only. Never copy Grafana code, UI, icons, text or names into Paarvix (CLAUDE.md §16.5). Grafana is not needed to build or run Paarvix.

## Docs

| # | Doc | Covers |
|---|---|---|
| 1 | [Architecture](01-architecture.md) | Binary, storage, dependencies, size, startup |
| 2 | [Connectors and data flow](02-connectors-data-flow.md) | Connector lifecycle, query path, frames, expressions |
| 3 | [Login methods](03-login-methods.md) | Password, OAuth, LDAP, JWT, proxy, tokens, sessions |
| 4 | [Users and permissions](04-users-permissions.md) | Orgs, teams, roles, folders, what Viewers can do |
| 5 | [Dashboards and customisation](05-dashboards-customisation.md) | Dashboard model, versions, panels, plugins, languages, UI |
| 6 | [Alerting](06-alerting.md) | Rule pipeline, routing, channels |
| 7 | [Operations and config](07-operations-config.md) | Config, provisioning, telemetry, defaults, API |
| 8 | [Lessons for Paarvix](08-lessons-for-paarvix.md) | Copy-the-idea list, avoid list, gaps to win |
| 9 | [Pages, settings and feature map](09-pages-and-settings.md) | Every route, setting group, panel, data source and transformation, mapped to Paarvix |
| 10 | [Inner forms and behaviour](10-inner-forms-and-behaviour.md) | Admin pages, panel and data source options, Enterprise, plugins, behaviour tests, speed |
| 11 | [Source inventory](11-source-inventory.md) | Name-only lists from the 13.4.0-pre source: routes, services, flags, options, editions |

## Evidence labels

- **[O] Observed:** tested on the lab instance, or read from its shipped files.
- **[K] Background:** general product knowledge, not verified here.
- **[R] Recommendation:** Paarvix opinion, not a Grafana fact.

## Method

Six isolated containers with default settings except for the feature being tested: main, anonymous-for-UI, auth proxy, JWT, generic OAuth, LDAP (with a real OpenLDAP server), plus Postgres and, in an earlier lab, Prometheus. All data was synthetic. The labs have been removed.

## Limits

- **Enterprise and Cloud** were not tested. Paths in the API spec do not prove a feature works in OSS.
- **OAuth** was tested only as far as the redirect to the provider; no real provider completed a login.
- **SAML** was not tested.
- **Alert delivery** was not tested; no notification was sent.
- **UI:** 14 pages were screenshotted without logging in as a user, using an anonymous Admin; 3 were reviewed closely. No clicking or browser network trace.
- **REA:** binary too large for its Go inspector (475 MB vs 256 MiB); the web bundle scan found only 4 route candidates from 36 scripts, with 223 gaps, so it is not used as evidence for routes. The SQLite inspection worked (`ev_d028ad7e33b1117b61179b5e93042292030404939acb88a79d89838437157dfd`).
- **Transformations list:** IDs are in doc 9. What each does in detail is not documented.
- **Performance at scale** was not measured.

The earlier single-file report, [grafana-13-research.md](../grafana-13-research.md), is superseded where these docs differ.
