# Pages, Settings and Feature Map

An inventory of what Grafana OSS 13.0.2 offers, and where each capability would land in Paarvix.

**Clean-room rule:** this records what exists, in our own words. Build the capability with our own design, code, text and icons. Never copy Grafana's code, UI, icons or names (CLAUDE.md §16.5). Grafana is AGPL and owned by Grafana Labs, so copied code would also end Paarvix's right to sell commercial licences.

## How this was gathered

| Source | Result |
|---|---|
| Shipped frontend files in the local `grafana` container | 126 route paths written as plain text **[O]**. This is a floor: routes built from variables were missed |
| `conf/defaults.ini` | 113 settings sections, 832 settings **[O]** |
| `public/api-merged.json` | 212 API paths, 430 operations, including Enterprise **[O]** |
| `public/app/plugins` | Panels and data sources **[O]** |
| Frontend bundle | 40 transformation IDs **[O]** |
| REA screenshot of the login page | Evidence `ev_732c29bf8f3ade317e3a5d67bc143ffddff3bf923cd7acd9b1f340af0eadd97c` |
| REA bundle analysis of the login page | Only 3 routes, because other pages load later. Evidence `ev_8eea8d0460d56dd60084baec6ba63e920ed3cd47756ed9515f8982b19be7267b` |

**Limits:** see "Second pass" at the end, which corrects this list. Page purposes are **[K]** background knowledge unless the second pass observed them. A route existing does not prove it works in OSS, since some are Enterprise or Cloud features or hidden behind feature flags.

## How to read the Paarvix column

- **Done:** exists today.
- **Stage N:** in the current roadmap (`docs/roadmap.md`).
- **PN:** a phase in `CLAUDE.md`, later than the current stages.
- **Pro / Ent:** planned for a paid edition.
- **Skip:** not needed, or against §7.14 non-goals.

## Pages

### Sign-in and account

| Route | Purpose | Paarvix |
|---|---|---|
| `/login` | Sign in | Done |
| `/signup`, `/verify` | Self sign-up and email check | Skip for now |
| `/invite/:code` | Accept an invitation | Stage 4 |
| `/user/password/send-reset-email`, `/user/password/reset` | Reset a forgotten password | Stage 4 |
| `/profile`, `/profile/password` | Own profile and password | Stage 4 |
| `/profile/notifications` | Own notification choices | Stage 4 |
| `/profile/select-org` | Switch organisation | P3 |
| `/org/new` | Create organisation | P3 |

### Home and navigation

| Route | Purpose | Paarvix |
|---|---|---|
| `/` | Home | Done, basic |
| `/bookmarks` | Pinned pages | P2 |
| `/goto/*` | Short links | P2 |
| `/notifications` | In-app notices | P2 |
| `/apps`, `/a/:pluginId/*` | App plugins | P2 |
| `/your-connections/:page` | Connections area | Done as Data Sources |
| `/plugins`, `/plugins/browse`, `/plugins/:pluginId/` | Plugin catalogue | P2, marketplace P4 |

### Dashboards

| Route | Purpose | Paarvix |
|---|---|---|
| `/dashboards` | Browse dashboards and folders | Done, basic list |
| `/dashboards/f/:uid`, `/:slug` | Folder view | Stage 2 |
| `/dashboards/f/:uid/:slug/alerting` | Folder's alert rules | Stage 4 |
| `/dashboards/f/:uid/:slug/library-panels` | Folder's reusable panels | P2 |
| `/dashboard/new`, `/dashboard/new-with-ds/:datasourceUid` | Create a dashboard | Stage 2 |
| `/dashboard/import` | Import from JSON | Stage 2 |
| `/d/:uid/:slug?` | View and edit a dashboard | Stage 2 |
| `/d-solo/:uid/:slug?` | One panel alone, for embedding | Stage 2 |
| `/dashboard/snapshots` | Saved point-in-time copies | P2 |
| `/dashboard/public` | List of public dashboards | Stage 2 |
| `/public-dashboards/:accessToken` | Public view | Stage 2 |
| `/dashboard/recently-deleted` | Restore deleted dashboards | P2 |
| `/library-panels` | Reusable panels | P2 |
| `/playlists`, `/new`, `/edit/:uid`, `/play/:uid` | Rotating dashboards | P2 (TV mode) |

### Explore and observability

| Route | Purpose | Paarvix |
|---|---|---|
| `/explore` | Free-form querying | Stage 2, as Queries |
| `/explore/metrics/*`, `/drilldown` | Guided drill-down | P3 |
| `/datasources/correlations` | Links between sources | P4 |
| `/observability`, `/infrastructure`, `/monitoring`, `/frontend` | Monitoring areas | P3 |
| `/testing-and-synthetics`, `/alerts-and-incidents`, `/adaptive-telemetry` | Cloud-style areas | Skip |

### Alerting

| Route | Purpose | Paarvix |
|---|---|---|
| `/alerting/home` | Overview | Stage 4 |
| `/alerting/list` | All rules | Stage 4 |
| `/alerting/new/:type?`, `/alerting/:id/edit` | Create and edit a rule | Stage 4 |
| `/alerting/:sourceName/:id/view`, `/alerting/:sourceName/:name/find` | Rule details | Stage 4 |
| `/alerting/groups/` | Grouped live alerts | P3 |
| `/alerting/history/` | Rule state history | Stage 4 |
| `/alerting/notifications` | Contact points | Stage 4, email only |
| `/alerting/notifications/receivers/new`, `/:name/edit` | Create and edit contact points | Stage 4 |
| `/alerting/notifications/templates`, `/*` | Message templates | P3 |
| `/alerting/notifications/global-config` | Global sending settings | Stage 4 |
| `/alerting/notifications-history`, `/view/:uuid` | Sent notifications | Pro |
| `/alerting/routes`, `/policy/:name/edit` | Routing policies | P3 |
| `/alerting/routes/mute-timing`, `/new`, `/edit` | Scheduled quiet times | P3 |
| `/alerting/silences`, `/silence/new`, `/:id/edit`, `/:id/view` | Silences | P3 |
| `/alerting/recently-deleted/` | Restore deleted rules | P3 |
| `/alerting/admin`, `/admin/alertmanager` | Alerting settings | P3 |
| `/alerting/export-new-rule`, `/:id/modify-export`, `/import-*` | Rule import and export | P3 |
| Namespace and group edit and view routes | Group editing | P3 |

### Organisation

| Route | Purpose | Paarvix |
|---|---|---|
| `/org` | Organisation preferences | Stage 4 |
| `/org/users`, `/org/users/invite` | Members and invitations | Stage 4 |
| `/org/teams`, `/new`, `/edit/:uid/:page?` | Teams | P2 |
| `/org/serviceaccounts`, `/create`, `/:id` | Machine accounts and tokens | P3 |

### Server admin

| Route | Purpose | Paarvix |
|---|---|---|
| `/admin`, `/admin/general` | Admin home | Stage 4 |
| `/admin/users`, `/create`, `/edit/:id` | All users | Stage 4 |
| `/admin/orgs`, `/edit/:id` | All organisations | P3 |
| `/admin/stats` | Usage statistics | P3 |
| `/admin/settings` | Read-only effective settings | P2 |
| `/admin/plugins` | Plugin management | P2 |
| `/admin/authentication`, `/:provider`, `/ldap` | Sign-in providers | Ent |
| `/admin/access` | Roles and permissions | Pro |
| `/admin/extensions`, `/admin/upgrading` | Extensions and licence | P2 |
| `/admin/migrate-to-cloud` | Move to hosted version | Skip |
| `/support-bundles`, `/create` | Diagnostics for support | P2 |

### Developer pages

`/theme-playground`, `/sandbox/test`, `/sandbox/benchmarks`, `/dashboards/embedding-test`, `/dashboard/assistant-preview/*`, `/femt`, `/isEditing`, `/metadata/ownerReferences`: internal tools. Skip.

## Settings

Grafana keeps 832 settings in 113 sections. Paarvix should not match this count. Principle 1 is progressive power, so each setting needs a user who asks for it.

| Group | Sections | Settings | What it controls | Paarvix |
|---|---|---|---|---|
| Paths and server | `paths`, `server`, `environment`, `grpc_server` | 42 | Ports, TLS, domain, compression, folders | Done through env, basic |
| Database | `database`, `remote_cache`, `unified_storage` | 36 | Connection, pools, cache | Done through env |
| Data proxy | `dataproxy`, `secure_socks_datasource_proxy`, `sql_datasources` | 23 | Timeouts, limits, private network tunnels | Limits done, tunnels P2 |
| Security | `security`, `security.encryption`, `secrets_manager*`, `secretscan` | 42 | Encryption, cookies, HSTS, CSP, brute-force limits, embedding | Partly done, Stage 4 |
| Users | `users`, `service_accounts` | 21 | Sign-up, default role, theme, language, hints | Stage 4 |
| Sign-in | `auth`, `auth.anonymous`, `auth.basic`, `auth.proxy`, `auth.jwt`, `auth.ldap`, OAuth sections for GitHub, GitLab, Google, Azure AD, Okta and generic, `sso_settings` | 266 | Sessions, providers, role mapping | Password Done, SSO Ent |
| Access | `rbac`, `quota` | 21 | Roles and per-org limits | Pro, P3 |
| Email | `smtp`, `emails` | 14 | Mail server and templates | Stage 4 |
| Logging | `log*` | 30 | Levels, files, syslog, browser errors | P2 |
| Alerting | `unified_alerting*`, `recording_rules`, `remote.alertmanager` | 91 | Evaluation, history, screenshots, external alert manager | Small part in Stage 4 |
| Dashboards | `dashboards`, `panels`, `annotations*`, `snapshots`, `public_dashboards`, `query_history`, `short_links`, `explore`, `query`, `expressions`, `geomap`, `time_picker`, `date_formats` | About 50 | Versions kept, minimum refresh, retention, date formats | Stage 2 |
| Plugins | `plugins*`, `panels` | 19 | Allow lists, signatures, catalogue | P2 |
| Monitoring itself | `metrics*`, `tracing.*`, `analytics` | 37 | Prometheus endpoint, tracing, usage reporting | P2, telemetry opt-in only (§9.14) |
| Rendering and images | `rendering`, `plugin.grafana-image-renderer`, `external_image_storage*` | 50 | PDF and image export, cloud storage | Pro |
| Live | `live` | 8 | Streaming connections | P3 |
| Cloud clients | `aws`, `azure`, `grafana_net`, `grafana_com`, `cloud_migration` | 46 | Cloud credentials and vendor links | Mostly Skip |
| Other | `feature_toggles*`, `navigation.*`, `help`, `profile`, `news`, `search`, `storage`, `support_bundles`, `provisioning`, `frontend_dev`, `enterprise` | About 25 | Flags, menu layout, provisioning as files | Provisioning P2 |

Group counts are rounded from the section totals.

## Panels

| Panel | Paarvix |
|---|---|
| Time series, bar chart, stat, gauge, table, pie chart, heatmap, text | P1, Stage 2 |
| Bar gauge | P1, Stage 2 |
| Histogram, XY chart, geomap, state timeline, status history, trend | P2 |
| Candlestick, canvas, node graph | P3 |
| Logs, logs table, traces, flame graph | P3, connect only (§7.14) |
| Alert list, annotation list, dashboard list, news, welcome, getting started | Own versions as needed |

## Data sources

| Source | Paarvix |
|---|---|
| PostgreSQL, MySQL | Done on this branch |
| Microsoft SQL Server, Prometheus, InfluxDB | P2 |
| Azure Monitor, CloudWatch, Google Cloud Monitoring | P3 |
| Loki, Tempo, Jaeger, Zipkin, Parca, Pyroscope, Graphite, OpenTSDB, Alertmanager | Add on demand |
| Mixed, Dashboard (reuse another panel) | P4, P2 |
| TestData | Skip |

Paarvix adds what Grafana does not ship in OSS: Excel and Google Sheets, on this branch.

## Transformations

| Group | Transformations | Paarvix |
|---|---|---|
| Combine | `merge`, `joinByField`, `joinByLabels`, `concatenate`, `append`, `seriesToColumns`, `seriesToRows` | P2 |
| Shape | `organize`, `transpose`, `rowsToFields`, `labelsToFields`, `extractFields`, `partitionByValues`, `groupingToMatrix`, `groupToNestedTable`, `ensureColumns`, `prepareTimeSeries`, `timeSeriesTable`, `configFromData` | P2 |
| Filter | `filterByRefId`, `filterByValue`, `filterFieldsByName`, `filterFrames`, `limit` | P2 |
| Calculate | `calculateField`, `reduce`, `groupBy`, `groupby`, `histogram`, `heatmap`, `regression`, `smoothing`, `spatial` | P2, partly |
| Format | `convertFieldType`, `formatString`, `formatTime`, `renameByRegex`, `sortBy`, `fieldLookup` | P2 |
| Other | `debug`, `noop` | Skip |

## API areas

430 operations across 42 groups. The largest are Enterprise (70), provisioning (31), access control (25), dashboards (25) and data sources (20). A public API is P3 in `CLAUDE.md`.

## Where Paarvix goes further

**[R]** Parity is the floor, and these are what Grafana does not lead on:

- Excel to dashboard in minutes.
- Sector packs with column matching.
- Plain-language questions in English and Tamil.
- Indian number, date and lakh or crore formats.
- A 2 GB one-command install.
- WhatsApp alerts, in Pro.

## Suggested order

1. Finish Stage 1.
2. Stage 2: dashboards, panels, filters, folders, sharing, and the free-form query page.
3. Stage 4: alert rules, email, users and roles.
4. P2: transformations, more panels, library panels, playlists, plugins.

Grafana took more than ten years to reach this list, so full parity is a multi-year goal for one person. Build what the first paying customers need.

## Second pass: what the first list missed

Run on a throwaway Grafana 13.0.2 with anonymous Admin, then removed. No password was used.

| Source | Result |
|---|---|
| Real menu, crawled in a browser | 29 menu entries, 28 visited **[O]** |
| Plugin API | 27 panels, 18 data sources **[O]** |
| English UI strings | 10,206 strings in 207 feature areas **[O]** |
| Feature flags | 64 reported on by the server, 157 or more referenced in the frontend **[O]** |

### Pages missed by the first list

| Route | Purpose | Paarvix |
|---|---|---|
| `/connections`, `/connections/add-new-connection`, `/connections/datasources` | Connections home, add, list | Done as Data Sources |
| `/connections/datasources/edit/:uid`, `/datasources/new`, `/datasources/edit/:uid/dashboards` | Edit a source, and its starter dashboards | Done, basic. Starter dashboards Stage 3 |
| `/connections/private-data-source-connections`, `/connections/infrastructure` | Private network and collector links | Skip |
| `/admin/provisioning` | Repositories, connections, get started (Git sync) | P2 |
| `/dashboard/provisioning`, `/dashboard/template`, `/dashboards?templateDashboards` | Dashboards from Git and templates | Stage 3 for templates |
| `/alerting/new/recording`, `/alerting/new/grafana-recording`, `/alerting/notifications/templates/new` | Recording rules and new templates | P3 |

Bundled app pages under `/a/` also exist for logs, metrics, traces and profiles drill-down. Four such plugins are in the local `grafana` container. Skip, per §7.14.

### Features the first list missed

| Area | What exists | Paarvix |
|---|---|---|
| Variables | Query, custom, text box, constant, data source, interval, ad hoc filter, switch, group by | Stage 2, §7.5 |
| Dashboard layout | Rows, tabs, auto grid, conditional rendering, undo and redo | Stage 2 |
| Dashboard extras | Links, annotations, version history, starring, tags, JSON view | Stage 2, versions Pro |
| Panel options | Field overrides, thresholds, value mappings, data links, actions, suggested chart types | Stage 2, P2 |
| Panel tools | Query inspector, data view, stats, panel JSON | P2 |
| Sharing | Link, embed, snapshot, image, export, library panel, public, email-only public | Stage 2, P2 |
| Time | Time picker, refresh picker, time zones, per-panel time, fiscal year | Stage 2 |
| Queries | Expressions, SQL expressions, query history, query caching | P2, P3 |
| Navigation | Command palette, keyboard shortcuts, help, starred, recently viewed, scopes | P1 for palette |
| Files as config | Provisioning for data sources, dashboards, alerting, plugins and access control | P2 |
| Git sync | GitHub, GitLab, Bitbucket, and local files | P2 |
| Alerting depth | Recording rules, inhibition, version history and restore, backtesting, enrichment, YAML import, triage. About 20% of all UI strings | P3, Pro |
| AI | Generated dashboard changes and an assistant, behind flags | P2 onward, a Paarvix strength |
| Accessibility | Colour-blind themes and palettes | P1 |
| Languages | 19 languages | English and Tamil first |
| Email | Seven kinds of template: alert, invite, new user, password reset, sign-up, verify, welcome | Stage 4 |
| Command line | `plugins`, and `admin` for password reset and data and secrets migration | P1, §7.11 |

### Corrections

- **Elasticsearch:** bundled on disk, but not returned by the plugin API. It is in the §7.2 P2 list.
- **`/alerting/groups`:** the menu link showed "Page not found" without the trailing slash.
- **Panels:** `debug`, `live`, `logstable` and test files exist on disk, but are not in the 27 listed by the API.

### Further coverage

Server admin pages, inner forms, Enterprise and Cloud, third-party plugins and behaviour tests are in [doc 10](10-inner-forms-and-behaviour.md), which also lists what remains unverified.
