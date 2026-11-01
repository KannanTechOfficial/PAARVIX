# Grafana 13.0.2 — Product Research for Paarvix

> **Superseded** by the detailed set in [grafana/](grafana/README.md). Corrections: lockout is confirmed working, dashboard versioning works, and Tamil is not bundled.

> **Date:** 2026-11-01. **Subject:** `grafana/grafana-oss:latest` = 13.0.2 (commit `3fcdbc5a`), edition "Open Source", default config.
>
> **Clean-room rule (CLAUDE.md §16.5):** this is a study of behaviour and capabilities, for ideas only. Do not copy Grafana code, UI, icons, text or names into Paarvix. Grafana does **not** need to be installed to build or run Paarvix.

**Evidence labels**
- **[O] Observed** — seen on the running instance, its shipped config, its API spec, or its binary.
- **[K] Background knowledge** — from general product knowledge, not verified in this session. Check it before relying on it.
- **[R] Recommendation** — a Paarvix design opinion, not a fact about Grafana.

## 1. How the research was done, and its limits

| Method | Result |
|---|---|
| Temporary container on localhost, default settings | Ran; removed afterwards |
| Live HTTP API with the default admin login | Settings, plugins, SSO, service accounts, metrics |
| `conf/defaults.ini` and `conf/provisioning` samples | 113 config sections read |
| REA `inspect_sqlite_database` on `grafana.db` | Evidence `ev_d028ad7e33b1117b61179b5e93042292030404939acb88a79d89838437157dfd` |
| REA `inspect_go_binary` | **Failed**: the binary is 475 MB and REA's limit is 256 MiB. Dependency list came from `strings` on build info instead (544 modules) |
| REA browser capture of the UI | **Not completed**: calls were rejected on input format. No UI, screenshot or frontend-bundle analysis in this report |

A second lab connected real Postgres and Prometheus containers; results are in section 12.

**Not tested:** OAuth, LDAP, SAML, JWT and proxy login, alert delivery, and the browser UI (no screenshots, frontend bundle analysis, or browser network trace; REA loaded the login page but the scripted login was rejected on input format). Login sections describe config surface, not proven behaviour. Enterprise and Cloud features were not available. Only part of `defaults.ini` was read in detail.

## 2. Architecture

- **[O]** One Go server binary (452.7 MB on disk in the image) plus a `public/` frontend. `grafana server` runs it; `grafana cli` has `plugins` and `admin` commands.
- **[O]** Idle memory after startup: about **151 MiB**, with no data sources or users. Default storage is SQLite at `/var/lib/grafana/grafana.db`.
- **[O]** Schema is created by a logged migration runner at every start (`migration_log` table).
- **[O]** Key embedded dependencies:

| Dependency | Version | Likely role (inferred from the library) |
|---|---|---|
| `k8s.io/apiserver` | 0.35.1 | Kubernetes-style resource APIs |
| `openfga/openfga` | 1.14.2 | Relationship-based authorization |
| `prometheus/alertmanager` | 0.28.2 | Alert routing |
| `centrifugal/centrifuge` | 0.38.0 | Live/WebSocket messaging |
| `apache/arrow-go/v18` | 18.5.2 | Columnar data transfer |
| `hashicorp/go-plugin` | 1.7.0 | Backend plugins as separate processes |
| `blevesearch/bleve/v2` | 2.5.7 | Embedded search (`unified-search` directory exists) |
| `open-feature/go-sdk` | 1.17.1 | Feature flags |
| `go-ldap/ldap/v3` | 3.4.4 | LDAP |

**Two storage generations coexist [O].** Classic tables (`dashboard`, `dashboard_version`, `folder`) sit next to generic `resource`, `resource_history`, `resource_blob` and `resource_version` tables. `/apis` serves versioned groups such as `dashboard.grafana.app v2`, `folder.grafana.app v1` and `playlist.grafana.app v1`. That points to a migration from per-feature tables to one versioned resource store, and migration-log tables suggest it is still under way.

**[R]** Paarvix should use one versioned resource model from the start, because retrofitting it is clearly expensive.

## 3. Data model [O]

About 85 tables. Main groups:

| Area | Tables |
|---|---|
| Identity | `user`, `temp_user`, `org`, `org_user`, `team`, `team_member`, `user_auth`, `user_auth_token`, `user_external_session`, `login_attempt`, `anon_device`, `session` |
| Access | `role`, `permission`, `builtin_role`, `user_role`, `team_role`, `seed_assignment`, `dashboard_acl` (legacy) |
| Content | `dashboard`, `dashboard_version`, `dashboard_tag`, `dashboard_provisioning`, `dashboard_snapshot`, `dashboard_public`, `folder`, `library_element`, `library_element_connection`, `short_url`, `star`, `annotation` |
| Data | `data_source`, `correlation`, `query_history`, `query_history_star` |
| Alerting | `alert_rule`, `alert_rule_version`, `alert_instance`, `alert_configuration`, `alert_configuration_history`, `alert_image`, `provenance_type` |
| Secrets | `secrets`, `data_keys`, `signing_key`, `secret_keeper`, `secret_secure_value`, `secret_encrypted_value`, `secret_data_key` |
| Platform | `plugin_setting`, `quota`, `kv_store`, `server_lock`, `cache_data`, `sso_setting`, `preferences` |

Useful details: unique keys are scoped by org (`UQE_dashboard_org_id_uid`, `UQE_data_source_org_id_uid`); `user_auth_token` keeps `prev_auth_token`, which supports rotation; `server_lock` coordinates jobs between instances; `provenance_type` records where a resource came from.

## 4. Login methods

### Observed config surface [O]

| Method | Config section | Notes |
|---|---|---|
| Username + password | `[auth]`, `[auth.basic]` | `disable_login_form` can hide it |
| GitHub, GitLab, Google, Azure AD, Okta | `[auth.<provider>]` | `/api/v1/sso-settings` lists these |
| Generic OAuth/OIDC | `[auth.generic_oauth]` | See mapping keys below |
| grafana.com | `[auth.grafana_com]` | Vendor account |
| LDAP | `[auth.ldap]`, `conf/ldap.toml`, `ldap_multiple.toml` | Admin routes for status, reload, per-user sync |
| Auth proxy | `[auth.proxy]` | Trusts a header; has IP `whitelist`, `auto_sign_up`, `sync_ttl` |
| JWT | `[auth.jwt]` | JWKS URL or file, `expect_claims`, optional `url_login` |
| Anonymous | `[auth.anonymous]` | Tracked in `anon_device` |
| Service-account tokens | `[service_accounts]` | For machines |
| SAML | `/saml/acs`, `/saml/metadata`, `/saml/slo` in API spec | Paths are in the spec; **[K]** SAML is an Enterprise feature |

SSO settings can be edited at runtime and stored in `sso_setting` (`reload_interval = 1m`), not only in files.

Generic OAuth exposes expression-based mapping: `role_attribute_path`, `org_attribute_path`, `org_mapping`, `groups_attribute_path`, `team_ids_attribute_path`, plus `allowed_domains`, `allowed_groups`, `use_pkce`, `use_refresh_token` and `validate_id_token`.

### Session behaviour [O]

`POST /login` with a valid login set two cookies:
- `grafana_session`: HttpOnly, SameSite=Lax, 30-day Max-Age.
- `grafana_session_expiry`: readable by JavaScript, so the UI can see the expiry.

Tokens rotate every 10 minutes by default (`token_rotation_interval_minutes`). Failed login returns 401 with `messageId: password-auth.failed`, and the message does not say which field was wrong. Lockout default: 5 attempts, by username; IP-based protection is off by default.

### Insecure defaults Paarvix must not repeat [O]

`admin/admin` default login; a fixed `secret_key` in shipped config; `cookie_secure = false`; `content_security_policy = false`; `strict_transport_security = false`. Service-account and session management are good; these defaults are not.

**[R]** Paarvix should force an admin password in the setup wizard, generate secrets on first run, and turn secure settings on by default (CLAUDE.md §9).

## 5. User management and permissions

**Hierarchy [O]:** server → org → team → user, plus service accounts. A user can belong to several orgs (`org_user`). Service accounts are rows in `user` (index `IDX_user_is_service_account_last_seen_at`), and the API returned `role`, `tokens`, `isDisabled` for one.

**Defaults [O]:** `allow_sign_up = false`, `allow_org_create = false`, new users auto-join org 1 as Viewer. Invites live 24 hours; email verification links 1 hour. Users can list and revoke their own sessions (`/user/auth-tokens`, `/user/revoke-auth-token`); admins can do so too.

**Permissions [O]:** the model is `action` + `scope` attached to a role (`permission` table). The admin user had **178 distinct actions**, e.g. `dashboards`, `datasources`, `folders`, `teams`, `users`, `alert.rules`, `serviceaccounts`, `secret.securevalues`.

**OSS vs paid [O]:** `/api/access-control/roles` is in the spec but returned **404** on this OSS build, so the fine-grained model exists underneath while custom role management is not exposed. **[K]** That is the Enterprise boundary. The spec likewise lists `reports`, `licensing`, `groupsync` and team-group paths; being listed does not mean they work in OSS.

**Quotas [O]:** present, disabled by default (`org_user 10`, `org_dashboard 100`, `org_data_source 10`, `org_alert_rule 100`).

**[R]** Build Paarvix permissions as `action + scope` now, even with only four fixed roles in P1. Custom roles (Pro) then become UI on the same engine, which matches the open-core plan.

## 6. Connections

**Bundled data sources [O] (18):** alertmanager, azure-monitor, cloudwatch, stackdriver, pyroscope, graphite, influxdb, jaeger, loki, mssql, mysql, opentsdb, parca, postgresql, prometheus, tempo, testdata, zipkin. Virtual ones: Dashboard, Grafana, Mixed.

**How they work:**
- **[O]** Data source settings are per org (`data_source`). `[dataproxy]`, `[sql_datasources]` and `[secure_socks_datasource_proxy]` exist, so queries can go through the server or a tunnel.
- **[O]** Queries go to `POST /api/ds/query` and return columnar data frames (section 12).
- **[O]** `[expressions]`, `correlation` and `[query]`/`query_history` cover post-query maths, jumps between sources, and history.
- **[O]** A fresh install had no default data source; `/api/frontend/settings` gives the frontend its plugin and panel list.

**Absent from bundled list [O]:** Excel, CSV upload, Google Sheets, SQLite, REST/JSON. This is the Paarvix gap: **Grafana starts from infrastructure, Paarvix starts from a spreadsheet.**

## 7. Customisation and extensibility

| Layer | Observed mechanism [O] |
|---|---|
| Panels | 27 bundled, incl. timeseries, stat, gauge, bargauge, table, heatmap, histogram, piechart, geomap, canvas, candlestick, logs, traces, nodeGraph, flamegraph, state-timeline, xychart |
| Apps | 4 bundled: logs, metrics, traces, profiles drilldown |
| Plugin rules | `allow_loading_unsigned_plugins`, `plugin_admin_enabled`, `preinstall`, `update_strategy = minor`, `disable_plugins`, restricted API allow/block lists, optional `enable_frontend_sandbox_for_plugins` |
| Reuse | `library_element` shared panels; `playlist.grafana.app`; `/snapshots`; `dashboard_public` public links; `short_url` |
| Branding | `default_theme`, `default_language`, `home_page`, `[navigation.app_sections]`; `grafanaconThemes` flag is on |
| Feature flags | 64 enabled here, through `[feature_toggles]` and OpenFeature |
| Config layers | `defaults.ini` → custom file; **[K]** `GF_<SECTION>_<KEY>` environment overrides |

**[K]** Dashboards also use variables, transformations, overrides and thresholds, and white-labelling is an Enterprise feature. None of these was exercised here.

**Everything-as-code [O]:** `conf/provisioning` has five areas: `datasources`, `dashboards`, `alerting`, `access-control`, `plugins`. Samples show YAML with `apiVersion`, `deleteDatasources`, file providers, rule groups, and versioned roles. Newer Git-style sync appears as `provisioning.grafana.app`, `provisioning.repositories`, `provisioning.connections` and `/v1/provisioning` routes.

## 8. Alerting, realtime, API, observability

- **Alerting [O]:** rules (`alert_rule`, versioned) and instance state (`alert_instance`) are stored in the DB; routing uses the Alertmanager library. Permissions show receivers, routes, templates, time intervals, silences and inhibition rules. State history and screenshots have their own config. YAML import from Prometheus exists (`/convert/prometheus`).
- **Realtime [O]:** Centrifuge-based. Defaults `max_connections = 100`, `message_size_limit = 8 MB`. An optional `ha_engine` targets Redis-style addresses (`127.0.0.1:6379`) for multiple instances.
- **API [O]:** `public/api-merged.json` has 212 paths, largest groups `/v1/provisioning`, `/admin/users`, `/orgs`, `/datasources/uid`, `/dashboards/uid`. There is also `openapi3.json`, and `/swagger` responds.
- **Self-observability [O]:** `/metrics` exposes 2,686 lines starting `grafana_`. OpenTelemetry tracing and `[support_bundles]` exist. `grafanaAdvisor` and `advisor.grafana.app` indicate built-in health checks.
- **Scale hints [O]:** `[remote_cache]`, `[database]`, `[unified_storage]`, `[grpc_server]`, `server_lock`.

## 9. Grafana vs Paarvix

| Area | Grafana 13 OSS | Paarvix direction [R] |
|---|---|---|
| First run | Empty, needs a data source | Sample College dashboard, Excel upload |
| Language | No Tamil claim tested | English + Tamil first |
| Audience | Engineers | Principal to data engineer |
| Default security | Weak until configured | Secure by default |
| Data | Infrastructure sources | Files, Sheets, SQL, REST |
| Domain | Generic | Education templates |
| AI | `dashgpt` flag only observed; AI not tested | BYO key or local model, RLS first |

**Do not try to match:** logs, traces and profiling (§7.14 non-goal), or 18 cloud/infra data sources in P1.

## 10. What to take into Paarvix [R]

Ordered by phase; these are ideas to design ourselves.

**P0–P1 (now)**
1. `action + scope` permission engine behind the four fixed roles.
2. Org-scoped unique keys on every resource, ready for tenancy later.
3. Session table with rotation and user-visible revocation.
4. Service accounts as first-class identities with tokens.
5. Dashboard versioning in one generic resource/history model.
6. Provenance field: created by UI, file, or API.
7. Generated secrets, forced admin password, secure cookies, CSP and HSTS.
8. Layered config: defaults → file → environment.

**P2**
9. Provisioning folder for sources, dashboards and alerts.
10. Plugin signing, allow-list and frontend sandbox **on by default**.
11. Shared library panels and playlists (TV mode).
12. Generic OIDC with claim-to-role mapping before individual providers.

**P3+**
13. Alert model of rule → instance → route → receiver, with silences.
14. Realtime with connection limits and optional Redis.
15. Git sync; built-in health advisor.

**Open-core lesson:** keep the engine in Community and sell management, reporting and SSO, as the Pro/Enterprise split in CLAUDE.md §5 already plans.

## 11. Open items

- Run a real UI study with screenshots (REA browser capture needs correct arguments).
- Test each login method against a local identity provider.
- Check Tamil and other locale coverage.
- Current Paarvix text says "Grafana-grade" in `apps/web/src/app/features/dashboards/dashboards.component.ts:316`. Replace it with neutral wording, since user-facing copy should not lean on another company's trademark.

## 12. Live data-flow lab [O]

Setup: Grafana 13.0.2, Postgres 17 with a synthetic `marks` table, Prometheus, on an isolated Docker network, driven by the HTTP API.

### One query, end to end

```
Panel target (rawSql or expr + datasource uid + refId)
  -> POST /api/ds/query  {from, to, queries[]}
  -> permission check on caller
  -> data source settings + decrypted secret loaded on server
  -> macros expanded, time range applied
  -> plugin runs query against the source
  -> {results: {<refId>: {status, frames[]}}}
  -> optional expression step in the same request
```

### Connector lifecycle

| Step | Observed |
|---|---|
| Create | `POST /api/datasources` with `jsonData` (plain) and `secureJsonData` (secret); gets a generated `uid` |
| Secret on read | Never returned; only `secureJsonFields: {password: true}` |
| Secret at rest | Encrypted value in `data_source.secure_json_data`, not plaintext |
| Health | `GET /api/datasources/uid/<uid>/health` returned `Database Connection OK` for Postgres; Prometheus also returned detected features |
| Schema/metadata | Pass-through: `/api/datasources/uid/<uid>/resources/api/v1/labels` returned Prometheus labels |

### Data frame shape

Column-oriented, not rows:

```json
{"schema":{"refId":"A","meta":{"executedQueryString":"..."},
  "fields":[{"name":"dept","type":"string","typeInfo":{"frame":"string","nullable":true}},
            {"name":"a","type":"number","typeInfo":{"frame":"float64","nullable":true}}]},
 "data":{"values":[["CSE","ECE"],[66.8,67.4]]}}
```

- The executed SQL is returned to the caller, which helps transparency.
- Prometheus frames carry `meta.type: timeseries-multi`, and per-series `labels` on the value field.
- Asking for Arrow via the `Accept` header still returned JSON on this route.

### Macros and expressions

- `$__timeFilter(ts)` became `ts BETWEEN '<from>' AND '<to>'`; `$__timeGroup(ts,'1d')` became `floor(extract(epoch from ts)/86400)*86400`.
- A `__expr__` query with `type: reduce` over refId A returned one value alongside A. Expressions run on the server, so alerts can reuse them.

### Security results

| Test | Result |
|---|---|
| `delete from marks` through `/api/ds/query` as admin | **Succeeded; table went to 0 rows.** The lab DB user was a superuser. Grafana did not block it |
| Viewer service account: list data sources | 200 |
| Viewer: delete data source | 403 |
| Viewer: run arbitrary query | **200.** The same raw-SQL route accepted a Viewer token |
| Service-account token | `glsa_` prefix, 46 characters, Bearer header; acts as login `sa-1-bot` |
| 6 bad logins, unknown user | All 401; no distinct lockout response seen, so lockout was not confirmed |
| Public dashboard | Token URL returned 200 and `/panels/1/query` ran with no login. The viewer sends only a panel ID; the query is held on the server |

**[R]** Paarvix must enforce SELECT/WITH-only on the server (CLAUDE.md §9.6) and must not let Viewers submit raw SQL. Keep Grafana's public-link pattern: the server holds the query and the viewer sends only a panel ID.

### Dashboard, alert, startup

- Dashboards are JSON: `title`, `panels[]` (`type`, `gridPos`, `datasource`, `targets`), `templating`. Reads add a `meta` block with permission flags (`canEdit`, `canSave`, `provisioned`). Default permissions: Editor edit, Viewer view.
- Version behaviour is unconfirmed: two saves in the lab both returned version 1, and that test needs redoing with a real content change.
- Alert rule pipeline: A (query) -> B (reduce) -> C (threshold), with `condition: C`. Created through the API, it was stamped `provenance: api`. Default route groups by folder and alert name.
- Default policy receiver was `empty`, so alerts go nowhere until a contact point is set.
- Notifier types: LINE, dingding, discord, email, googlechat, jira, kafka, mqtt, oncall, opsgenie, pagerduty, prometheus-alertmanager, pushover, sensugo, slack, sns, teams, telegram, threema, victorops, webex, webhook, wecom. **WhatsApp is absent**, which supports Paarvix's India focus.
- At startup Grafana began installing `grafana-lokiexplore-app` from the network, so it has outbound calls by default. Paarvix must remain silent by default for air-gapped use.
- Memory with both sources connected: about 155 MiB.

### Paarvix connector contract [R]

These lab findings map directly to the §8.3 `Connector` interface, with one addition, a metadata resource path:

| Grafana behaviour | Paarvix contract |
|---|---|
| `/health` | `testConnection` |
| `/resources/...` | `discoverSchema` |
| `/api/ds/query` by refId | `query(cfg, spec, ctx)` with mandatory `SecurityContext` |
| Data frames | `DataFrame` with typed fields; add Arrow on the wire from the start |
| `jsonData` / `secureJsonData` split | Same split; secrets write-only |
| Expressions | `Transform` pipeline on the server |
