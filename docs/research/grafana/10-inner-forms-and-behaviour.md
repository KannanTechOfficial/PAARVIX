# Inner Forms, Enterprise, Plugins and Behaviour

Companion to [doc 9](09-pages-and-settings.md). It covers what that doc left out. **Clean-room rule applies:** these are facts for planning. Paarvix uses its own design, code and wording.

**Method:** a throwaway Grafana OSS 13.0.2 on this laptop, with server-admin access through an auth proxy and no password, removed afterwards. Dashboards used the built-in test data source. Data source forms were opened, but never connected to a real system.

## Server admin pages

All visited as a server admin. Menu: 46 entries.

| Route | Heading | Tabs | Fields |
|---|---|---|---|
| `/admin` | Administration | - | 0 |
| `/admin/general` | General | - | 0 |
| `/admin/upgrading` | Stats and license | - | 0 |
| `/org` | Default preferences | - | 6 |
| `/admin/settings` | Settings | - | 0 |
| `/admin/orgs` | Organizations | - | 0 |
| `/admin/migrate-to-cloud` | Migrate to Grafana Cloud | - | 0 |
| `/admin/provisioning` | Provisioning | Repositories, Connections, Get started | 0 |
| `/admin/plugins` | Plugins and data | - | 0 |
| `/admin/access` | Users and access | - | 0 |
| `/admin/users` | Users | All users, Organization users | 3 |
| `/org/teams` | Teams | - | 1 |
| `/org/serviceaccounts` | Service accounts | - | 5 |
| `/admin/authentication` | Authentication | - | 0 |
| `/profile` | Profile | - | 8 |
| `/profile/notifications` | Notification history | - | 3 |
| `/support-bundles` | Support bundles | - | 0 |
| `/admin/stats` | (none) | - | 0 |
| `/admin/orgs/edit/1` | Main Org. | - | 3 |
| `/admin/users/create` | New user | - | 4 |
| `/admin/users/edit/1` | admin | - | 0 |
| `/admin/authentication/ldap` | LDAP | - | 6 |
| `/admin/authentication/github` | (none) | - | 12 |
| `/admin/authentication/google` | (none) | - | 12 |
| `/admin/authentication/generic_oauth` | (none) | - | 16 |
| `/admin/extensions` | Administration | - | 0 |
| `/org/users` | Users | All users, Organization users | 3 |
| `/org/users/invite` | Invite user | - | 7 |
| `/org/teams/new` | New team | - | 2 |
| `/org/serviceaccounts/create` | Create service account | - | 2 |
| `/org/new` | New organization | - | 1 |
| `/profile/password` | Page not found | - | 0 |
| `/support-bundles/create` | Create support bundle | - | 14 |

**Notes:**
- `/profile/password` showed "Page not found" here, likely because the auth proxy owns passwords.
- `/admin/settings` is read-only: an instance's effective settings shown in a table.
- `/admin/users/edit/:id`, sign-in provider pages and invite forms all opened normally.
- Sign-in provider pages hold about 12 to 16 visible fields each, and LDAP 6 before expanding.

## Options common to most panels

Every panel editor shares these, so Paarvix should build them once:

`Title`, `Description`, `Transparent background`, `Repeat by variable`, `Table view`, `Data source`, `Max data points`, `Min interval`, `Interval`, `Relative time`, `Time shift`, `Unit`, `Field min/max`, `Decimals`, `Display name`, `Color scheme`, `No value`, `Data links`.

## Panel-specific options

Option names recorded from each panel editor after expanding its sections. Common options and picker values are removed.

| Panel | Count | Examples |
|---|---|---|
| `alertlist` | 19 | View mode, Stat, Group mode, Default grouping, Custom grouping, Max items, Sort order, Alerts linked to this dashboard, Alert name, Alert instance label, Datasource, Folder, Show alerts with 0 instances, Alerting / Firing |
| `annolist` | 13 | Query filter, All dashboards, Time range, Tags, Limit, Show user, Show time, Show tags, Link target, Panel, Dashboard, Time before, Time after |
| `barchart` | 47 | X Axis, Orientation, Horizontal, Vertical, Rotate x-axis tick labels, X-axis labels minimum spacing, Show values, Stacking, Normal, 100%, Bar width, Bar radius, Highlight full area on hover, Color by field |
| `bargauge` | 24 | Show, Calculate, All values, Calculation, Fields, Orientation, Horizontal, Vertical, Display mode, Gradient, Retro LCD, Basic, Value display, Value color |
| `candlestick` | 68 | Mode, Candles, Volume, Both, Candle style, OHLC Bars, Color strategy, Since Open, Since Prior Close, Up color, Down color, Open, High, Low |
| `canvas` | 22 | Inline editing, Experimental element types, Tooltip mode, Enabled, Disabled, Disable for one-click elements, Elements, Color, Image, Fixed, Field, Image size, Original, Contain |
| `dashlist` | 11 | Include current time range, Include current template variable values, Starred, Recently viewed, Search, Show headings, Show folder names, Max items, Query, Folder, Tags |
| `flamegraph` | 0 | Not captured |
| `gauge` | 29 | Show, Calculate, All values, Calculation, Fields, Style, Circle, Arc, Orientation, Horizontal, Vertical, Bar width factor, Segments, Bar Style |
| `geomap` | 34 | Initial view, View, Zoom, Share view, No map repeating, Sync view to dashboard variable, Layer type, Data, Location Mode, Styles, Size, Value, Symbol, Color |
| `gettingstarted` | 0 | Not captured |
| `heatmap` | 26 | Calculate from data, X Bucket, Size, Count, Y Bucket, Y Bucket scale, Linear, Logarithmic, Symlog, Placement, Min value, Max value, Axis width, Axis label |
| `histogram` | 23 | Bucket count, Bucket size, Bucket offset, Combine series, Stacking, Normal, 100%, Line width, Fill opacity, Gradient mode, Opacity, Hue, Scheme, Tooltip mode |
| `logs` | 21 | Show timestamps, Display log level, Font size, Wrap lines, Enable columns for displayed fields, Enable logs highlighting, Enable log details, Log details panel mode, Inline, Sidebar, Enable field selector, Enable infinite scrolling, Show controls, Unique labels |
| `news` | 2 | URL, Show image |
| `nodeGraph` | 5 | Zoom mode, Layout algorithm, Main stat unit, Secondary stat unit, Arc sections |
| `piechart` | 16 | Show, Calculate, All values, Calculation, Fields, Pie chart type, Pie, Donut, Slice sorting, Tooltip mode, Max width, Visibility, Mode, Placement |
| `stat` | 19 | Show, Calculate, All values, Calculation, Fields, Orientation, Horizontal, Vertical, Text mode, Color mode, Graph mode, Area, Text alignment, Show percent change |
| `state-timeline` | 21 | Merge equal consecutive values, Show values, Align values, Row height, Page size (enable pagination), Line width, Fill opacity, Connect null values, Threshold, Disconnect values, Visibility, Mode, Placement, Limit |
| `status-history` | 17 | Show values, Row height, Column width, Page size (enable pagination), Line width, Fill opacity, Visibility, Mode, Placement, Limit, Tooltip mode, Max width, Width, Actions |
| `table` | 20 | Show table header, Frozen columns, Cell height, Max row height, Enable pagination, Minimum column width, Column width, Column alignment, Wrap text, Wrap header text, Column filter, Calculation, Cell type, Cell value inspect |
| `text` | 5 | Mode, Markdown, HTML, Code, Content |
| `timeseries` | 52 | Tooltip mode, Hover proximity, Max width, Visibility, Mode, Placement, Limit, Values, Time zone, Label, Width, Show grid lines, Color, Text |
| `traces` | 3 | Filters, Show matches only, Select critical path |
| `trend` | 52 | X field, Tooltip mode, Hover proximity, Max width, Visibility, Mode, Placement, Limit, Values, Style, Lines, Bars, Points, Line interpolation |
| `welcome` | 0 | Not captured |
| `xychart` | 0 | Not captured |

**Limits:** the capture stopped at 200 labels per page, and the time picker used about 30 of them, so busy panels such as time series are partly cut off. `xychart`, `flamegraph`, `gettingstarted` and `welcome` showed no specific options here. Options that are not `<label>` elements, such as field overrides, were not recorded. Rely on the count as a minimum.

## Dashboard settings

Tabs: Settings, Annotations, Variables, Links, Versions, Permissions, JSON model. The JSON tab offers JSON and YAML.

General settings: title, description, tags, folder, editable or read-only, auto or custom grid, time zone, week start, auto refresh, now delay, hide time picker, refresh live dashboards.

## Data source forms

| Source | Fields seen | Tabs |
|---|---|---|
| `alertmanager` | 16 | Settings, Permissions, Insights |
| `grafana-azure-monitor-datasource` | 9 | Settings, Dashboards, Permissions, Insights, Cache |
| `cloudwatch` | 11 | Settings, Dashboards, Permissions, Insights, Cache |
| `elasticsearch` | 0 | Settings, Permissions, Insights |
| `stackdriver` | 6 | Settings, Dashboards, Permissions, Insights, Cache |
| `grafana-pyroscope-datasource` | 7 | Settings, Permissions, Insights, Cache |
| `graphite` | 13 | Settings, Dashboards, Permissions, Insights, Cache |
| `influxdb` | 18 | Settings, Permissions, Insights, Cache |
| `jaeger` | 18 | Settings, Permissions, Insights, Cache |
| `loki` | 11 | Settings, Permissions, Insights, Cache |
| `mysql` | 17 | Settings, Permissions, Insights, Cache |
| `opentsdb` | 14 | Settings, Permissions, Insights, Cache |
| `parca` | 7 | Settings, Permissions, Insights, Cache |
| `grafana-postgresql-datasource` | 16 | Settings, Permissions, Insights, Cache |
| `prometheus` | 23 | Settings, Permissions, Insights, Cache |
| `tempo` | 24 | Settings, Permissions, Insights, Cache |
| `grafana-testdata-datasource` | 2 | Settings, Setup, Dashboards, Permissions, Insights, Cache |
| `zipkin` | 18 | Settings, Permissions, Insights, Cache |

**Patterns worth noting:**
- Every source has a name, a default flag, and tabs for settings and permissions. Most add Insights and Cache tabs, which are Enterprise features advertised in the OSS screen.
- Common connection options: URL, authentication method, TLS settings, allowed cookies, timeout.
- SQL sources also ask for database, user and password, and TLS mode.
- `elasticsearch` opened with no fields, so its form was not captured.

## Enterprise

From Grafana's public docs and its shipped Enterprise API spec (45 paths). **None of this was run**, because it needs a paid licence.

| Area | Capability | Paarvix |
|---|---|---|
| Sign-in | SAML, team sync from groups, enhanced LDAP sync, protected roles | Ent |
| Access | Data source permissions by team or user, fine-grained roles | Pro |
| Reporting | Scheduled PDF reports by email, PDF export | Pro |
| Security | Audit log, outgoing request limits, Vault secrets | Pro, Ent |
| Performance | Query and resource caching | P2 |
| Insight | Usage insights | P3 |
| Data | Recorded queries | P3 |
| Admin | Runtime settings without restart | Later |
| Branding | White labelling: logo, name, footer links | Pro |
| Premium sources | About 40, including Snowflake, Oracle, MongoDB, Salesforce, ServiceNow, Jira, Datadog, Splunk, SAP HANA, Databricks | Build on demand |

The spec's largest groups are access control (18), reports (13), licensing (8) and recording rules (8).

## Cloud

From Grafana's public pages. **Not run**, and vendor pages may overstate. They also conflict on what is Cloud-only.

| Capability | Paarvix |
|---|---|
| Incident response and on-call | P3 for escalation, otherwise Skip |
| SLO management | Skip for now |
| Managed load testing (k6) | Skip |
| Adaptive telemetry, to reduce ingest costs | Skip |
| Frontend and session replay monitoring | Skip |
| Assistant: a core version runs self-hosted, and advanced features need the hosted backend | P2 onward, own design |

## Third-party plugins

From the public catalogue at `grafana.com/api/plugins`.

| Measure | Count |
|---|---|
| Listed | **383** |
| Data sources | 208 |
| Panels | 134 |
| Apps | 41 |
| Signed by Grafana Labs | 121 |
| Commercial signature | 85 |
| Community signature | 177 |
| Enterprise status | 41 |

The list includes core plugins, and may hide some that are not public.

**Popular examples:** Infinity (JSON, CSV and more), ClickHouse, OpenSearch, Zabbix, Clock, Polystat, Treemap, ECharts panel, Plotly, Calendar, Form panel.

**[R]** The most useful ideas for Paarvix are a universal JSON and CSV connector, an embedded ECharts panel (already in the Paarvix stack) and a form panel.

## Behaviour tests

Run through Grafana's API. Each is a real action with a checked result.

| Test | Result |
|---|---|
| Save a dashboard, in a folder | Pass, 24 ms |
| Version history records edits | Pass |
| Restore an old version | Pass |
| Snapshot, readable without login | Pass |
| Public dashboard link, without login | Pass |
| Query with a math expression | Pass, 15 ms |
| SQL expression | Failed with HTTP 500. The feature flag was not on, so it is off by default in this build |
| Annotation, library panel, playlist, short link | Pass |
| Search | Pass, 7 ms |
| Service account token, team | Pass |
| Viewer can read a dashboard | Pass |
| Viewer cannot save a dashboard or add a data source | Pass |
| Alert rule fires | Pass, within 5 seconds of checking |
| Webhook notification delivered | Pass, once a routing policy was active. The first attempt sent nothing while the alert stayed on the default empty receiver |

**A finding to copy the opposite of:** a Viewer could run any query on a data source through `/api/ds/query`, not only the dashboards it was given. Paarvix should not allow this, and today Viewers have no direct data routes.

## Speed and size

Same laptop as the load generator, using test data with 500 small dashboards. Treat these as rough figures.

| Measure | Result |
|---|---|
| Ready after container start | About 3.2 seconds |
| Memory at start | 150 MB |
| Memory after load test | 1,017 MB |
| Docker image | 1.47 GB |
| Server binary folder | 453 MB |
| Health check, 50 at once | 1,647 per second, p95 48 ms |
| Open dashboard, 50 at once | 164 per second, p95 518 ms |
| Search, 20 at once | 126 per second, p95 252 ms |
| Run a query, 50 at once | 201 per second, p95 573 ms |

All 7,000 requests succeeded. Paarvix idled at about 109 MB in its own test, but it has not had this load test, so the two are not yet comparable.

## Still not covered

[Doc 11](11-source-inventory.md) fills the option gaps from Grafana's source and docs. What remains:

- **Enterprise and Cloud:** described from public sources, never run.
- **Every option:** see the panel limits above. Query editors for each source were not explored.
- **Real systems:** no real database or provider was connected. SAML, LDAP and OAuth logins were not completed.
- **Scale:** nothing beyond this small load test.
- **Usability:** no real users were observed. These tests show that features work, not how easy they are.
