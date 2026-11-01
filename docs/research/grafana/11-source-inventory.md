# Source Inventory

Name-only lists taken by script from the local Grafana source at `grafana/` (ignored by git). **Clean-room rule:** this records what exists. No code was copied, and none may be. The folder must never be committed.

**Version gap:** the source is `13.4.0-pre` (commit `a7c265f91c4`), an unreleased development build. 13.0.2, used for docs 9 and 10, was the newest tag on Docker Hub on 2026-11-01, so anything only in this source is not yet released.

## Summary

| Item | Count | Source |
|---|---|---|
| Frontend feature folders | 61 | `public/app/features` |
| Backend services | 78 | `pkg/services` |
| Route strings in routing files | 139 | Frontend routing files, a floor |
| Route registrations | 249 | `pkg/api/api.go`, not counting app platform APIs |
| Feature flags | 401 | `registry.go` |
| Access actions | 107 | `accesscontrol/models.go`, other actions live elsewhere |
| Data source plugins | 22 | Released 13.0.2 build |
| Transformations with editors | 34 | Transformer registry |
| Documentation pages counted | 612 | `docs/sources`, without what's new and upgrade pages |

## Frontend feature areas

`AGENTS.md`, `actions`, `admin`, `alerting`, `annotations`, `apiserver`, `auth-config`, `bookmarks`, `browse-dashboards`, `canvas`, `cloudwatch-helpers`, `commandPalette`, `connections`, `correlations`, `dashboard`, `dashboard-prompt`, `dashboard-scene`, `datasources`, `dimensions`, `explore`, `expressions`, `folders`, `geo`, `gops`, `home`, `inspector`, `invites`, `library-panels`, `live`, `logs`, `loki-helpers`, `manage-dashboards`, `migrate-to-cloud`, `notebook`, `notifications`, `org`, `panel`, `panel-screenshot`, `playlist`, `plugins`, `profile`, `provisioning`, `query`, `runtime`, `sandbox`, `scopes`, `search`, `serviceaccounts`, `stars`, `support-bundles`, `table`, `teams`, `templating`, `theme-playground`, `trails`, `transformers`, `users`, `variables`, `variables-management`, `visual-refresh`, `visualization`.

## Backend services

`accesscontrol`, `annotations`, `anonymous`, `apikey`, `apiserver`, `auth`, `authapi`, `authn`, `authz`, `caching`, `cleanup`, `cloudmigration`, `contexthandler`, `correlations`, `dashboardimport`, `dashboards`, `dashboardsnapshots`, `dashboardversion`, `datasourceproxy`, `datasources`, `diagnostics`, `dsquerierclient`, `encryption`, `extsvcauth`, `featuremgmt`, `folder`, `folderreconcile`, `frontend`, `gcom`, `grpcserver`, `hooks`, `kmsproviders`, `ldap`, `libraryelements`, `librarypanels`, `licensing`, `live`, `login`, `loginattempt`, `navtree`, `ngalert`, `notebooks`, `notifications`, `oauthtoken`, `ofrep`, `org`, `plugindashboards`, `pluginsintegration`, `preference`, `promtypemigration`, `provisioning`, `publicdashboards`, `query`, `queryhistory`, `quota`, `rendering`, `scimutil`, `screenshot`, `search`, `searchusers`, `secrets`, `serviceaccounts`, `setting`, `shorturls`, `signingkeys`, `sqlstore`, `ssosettings`, `star`, `stats`, `store`, `supportbundles`, `swagger`, `tag`, `team`, `temp_user`, `updatemanager`, `user`, `validations`.

## Routes

`/` `/${ROUTE_BASE_ID}/*` `/*` `/a/:pluginId/*` `/adaptive-telemetry` `/admin` `/admin/access` `/admin/authentication` `/admin/authentication/:provider` `/admin/authentication/ldap` `/admin/extensions` `/admin/general` `/admin/migrate-to-cloud` `/admin/orgs` `/admin/orgs/edit/:id` `/admin/plugins` `/admin/settings` `/admin/stats` `/admin/upgrading` `/admin/users` `/admin/users/create` `/admin/users/edit/:id` `/alerting` `/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/edit` `/alerting/:dataSourceUid/namespaces/:namespaceId/groups/:groupName/view` `/alerting/:id/edit` `/alerting/:id/modify-export` `/alerting/:sourceName/:id/view` `/alerting/:sourceName/:name/find` `/alerting/admin` `/alerting/admin/alertmanager` `/alerting/admin/import` `/alerting/alerts` `/alerting/export-new-rule` `/alerting/groups/` `/alerting/history/` `/alerting/home` `/alerting/import-datasource-managed-rules` `/alerting/import-to-gma` `/alerting/list` `/alerting/new/:type?` `/alerting/notifications` `/alerting/notifications-history` `/alerting/notifications-history/view/:uuid` `/alerting/notifications/global-config` `/alerting/notifications/receivers/:name/edit` `/alerting/notifications/receivers/new` `/alerting/notifications/templates` `/alerting/notifications/templates/*` `/alerting/recently-deleted/` `/alerting/routes` `/alerting/routes/mute-timing` `/alerting/routes/mute-timing/:name/edit` `/alerting/routes/mute-timing/edit` `/alerting/routes/mute-timing/new` `/alerting/routes/policy/:name/edit` `/alerting/rules/alert` `/alerting/rules/recording` `/alerting/silence/:id/edit` `/alerting/silence/:id/view` `/alerting/silence/new` `/alerting/silences` `/alerts-and-incidents` `/apps` `/bookmarks` `/d-solo/:uid/:slug?` `/d/:uid/:slug?` `/dashboard-solo/:type/:slug` `/dashboard/:type/:slug` `/dashboard/assistant-preview/*` `/dashboard/import` `/dashboard/new` `/dashboard/new-with-ds/:datasourceUid` `/dashboard/public` `/dashboard/recently-deleted` `/dashboard/snapshots` `/dashboards` `/dashboards/embedding-test` `/dashboards/f/:uid` `/dashboards/f/:uid/:slug` `/dashboards/f/:uid/:slug/alerting` `/dashboards/f/:uid/:slug/library-panels` `/dashboards/f/:uid/:slug/variables` `/dashboards/f/:uid/variables` `/dashboards/variables` `/dashboards/variables/edit/:name` `/dashboards/variables/new` `/datasources/correlations` `/drilldown` `/explore` `/explore/metrics/*` `/femt` `/frontend` `/goto/*` `/infrastructure` `/invite/:code` `/library-panels` `/login` `/monitoring` `/notifications` `/observability` `/org` `/org/new` `/org/serviceaccounts` `/org/serviceaccounts/:id` `/org/serviceaccounts/create` `/org/teams` `/org/teams/edit/:uid/:page?` `/org/teams/new` `/org/users` `/org/users/invite` `/playlists` `/playlists/edit/:uid` `/playlists/new` `/playlists/play/:uid` `/plugins` `/plugins/:pluginId/` `/plugins/browse` `/profile` `/profile/notifications` `/profile/password` `/profile/select-org` `/public-dashboards/:accessToken` `/sandbox/benchmarks` `/sandbox/test` `/signup` `/support-bundles` `/support-bundles/create` `/testing-and-synthetics` `/theme-playground` `/user/password/reset` `/user/password/send-reset-email` `/verify`

Routes built from constants may be missing. Doc 9 has the grouped view.

## Feature flags

| Stage | Count |
|---|---|
| Experimental | 285 |
| GeneralAvailability | 54 |
| PublicPreview | 42 |
| PrivatePreview | 14 |
| Deprecated | 6 |

Most flags are experiments, so they are not stable features. Generally available flags:

`cloudWatchCrossAccountQuerying`, `lokiQuerySplitting`, `renderAuthJWT`, `awsDatasourcesTempCredentials`, `provisioningFolderMetadata`, `awsAsyncQueryCaching`, `reportingHeaderSettings`, `reportingFooterSettings`, `grafana.newPanelQueryErrorsUI`, `useKubernetesShortURLsAPI`, `cloudWatchBatchQueries`, `annotationPermissionUpdate`, `dashboardNewLayouts`, `timeComparison`, `alertingQueryOptimization`, `sqlExpressions`, `grafana.filterablePanels`, `cloudWatchNewLabelParsing`, `playlistsRBAC`, `savedQueriesRBAC`, `newSavedQueriesExperience`, `alertingListViewV2`, `alertingNavigationV2`, `pluginProxyPreserveTrailingSlash`, `azureMonitorPrometheusExemplars`, `cloudWatchRoundUpEndTime`, `useSessionStorageForRedirection`, `azureMonitorDisableLogLimit`, `enableSCIM`, `azureMonitorEnableUserAuth`, `lokiLabelNamesQueryApi`, `alertingRuleRecoverDeleted`, `unifiedNavbars`, `grafanaAssistantInProfilesDrilldown`, `foldersAppPlatformAPI`, `otelLogsFormatting`, `alertingNotificationHistory`, `newClickhouseConfigPageDesign`, `azureResourcePickerUpdates`, `onlyStoreActionSets`, `panelTimeSettings`, `rememberUserOrgForSso`, `grafana.scenesFlickeringFix`, `inlineLogDetailsNoScrolls`, `logsTablePanelNG`, `lokiAlignedQuerySplitting`, `profilesHeatmap`, `datasources.useNewStackInfoToSettingsCache`, `grafana.queryVarEditorRedesign`, `datetime.useLuxon`, `grafana.dashboardSettingsRedesign`, `grafana.thresholdsInterpolation`, `grafana.dashboardAutoGridDefault`, `grafana.announcementBannerDismissible`.

## Contact points

Documented integrations: alertmanager, amazon sns, discord, email, google chat, irm, jira, mqtt, opsgenie, slack, teams, telegram, pager duty, webhook.

Paarvix: email in Stage 4. WhatsApp, Telegram, Slack, Teams, SMS and webhook in Pro.

## Access control

Actions by area in `models.go`: alert (50), users (15), orgs (8), teams (6), org (4), ldap (4), annotations (4), library (4), variables (4), server (2), settings (2), receivers (2), datasources (1), live (1).

## Data source capabilities

All 22 data sources from the `plugin.json` files in the released 13.0.2 build, including internal ones.

| Source | Metrics | Logs | Traces | Alerting | Annotations | Streaming |
|---|---|---|---|---|---|---|
| -- Dashboard -- | Yes | - | - | - | - | - |
| -- Grafana -- | Yes | - | - | - | Yes | - |
| -- Mixed -- | Yes | - | - | - | - | - |
| Alertmanager | - | - | - | - | - | - |
| Azure Monitor | Yes | Yes | Yes | Yes | Yes | - |
| CloudWatch | Yes | Yes | - | Yes | Yes | - |
| Elasticsearch | Yes | Yes | - | Yes | Yes | - |
| Google Cloud Monitoring | Yes | Yes | - | Yes | Yes | - |
| Grafana Pyroscope | Yes | - | - | - | - | - |
| Graphite | Yes | - | - | Yes | Yes | - |
| InfluxDB | Yes | Yes | - | Yes | Yes | - |
| Jaeger | Yes | - | Yes | - | - | - |
| Loki | Yes | Yes | - | Yes | Yes | Yes |
| Microsoft SQL Server | Yes | - | - | Yes | Yes | - |
| MySQL | Yes | - | - | Yes | Yes | - |
| OpenTSDB | Yes | - | - | Yes | Yes | - |
| Parca | Yes | - | - | - | - | - |
| PostgreSQL | Yes | Yes | - | Yes | Yes | - |
| Prometheus | Yes | - | - | Yes | Yes | - |
| Tempo | Yes | - | Yes | Yes | - | - |
| TestData | Yes | Yes | - | Yes | Yes | - |
| Zipkin | Yes | - | Yes | - | - | - |

## Transformations in the registry

`calculateField`, `concatenate`, `configFromData`, `convertFieldType`, `extractFields`, `fieldLookup`, `filterByRefId`, `filterByValue`, `filterFieldsByName`, `formatString`, `formatTime`, `groupBy`, `groupToNestedTable`, `groupingToMatrix`, `heatmap`, `histogram`, `joinByField`, `joinByLabels`, `labelsToFields`, `limit`, `merge`, `organize`, `partitionByValues`, `prepareTimeSeries`, `reduce`, `regression`, `renameByRegex`, `rowsToFields`, `seriesToRows`, `smoothing`, `sortBy`, `spatial`, `timeSeriesTable`, `transpose`.

## Shared panel configuration

From the official configuration docs.

| Area | Headings |
|---|---|
| panel options | Description field formatting, Limitations of repeating panels, Show/hide rules, Query result rule, Template variable rule, Time range less than rule |
| value mappings | Supported visualizations, Types of value mappings, Value, Range, Regex, Special, Time series example, Stat example, Bar gauge example, Table example, Multiline regular expression example, Add a value mapping |
| tooltips | Supported visualizations, Tooltip mode, Values sort order, Hide zeros, Hover proximity, Max width, Max height, Show histogram (Y axis), Show color scale |
| data links | Supported visualizations, Actions, Supported visualizations, Data link and action variables #data-link-variables, Time range panel variables, Series variables, Field variables, Value variables, Data variables, Template variables, Add data links or actions #add |
| legend | Supported visualizations, Visibility, Mode, Placement, Width, Limit, Values, Series visibility, Change a series color, Isolate series data in a visualization, Sort series |
| thresholds | Supported visualizations, Default thresholds, Threshold value, Show thresholds, Add a threshold |
| overrides | Supported visualizations, Override rules, Fields with name, Fields with name matching regex, Fields with type, Fields returned by query, Fields with values, Add a field override, Edit a field override |
| standard options | Supported visualizations, Unit, Min, Max, Field min/max, Decimals, Display name, Color scheme, No value |

## Options by visualization

Headings from the official docs for each chart type. These replace the gaps in doc 10, including XY chart and flame graph.

| Visualization | Options |
|---|---|
| alert-list | Configuration options, Options, Sort order, Filter options, Alert state filter options |
| annotations | Configuration options, Annotation query options, Query filter, Time range, Display options, Link behavior options |
| bar-chart | Apply filters from the bar chart, Transform override property, Configuration options, Bar chart options, Gradient mode, Text size, Axis, Soft min and soft max |
| bar-gauge | Configuration options, Value options, Bar gauge options, Text size options |
| candlestick | Pan and zoom panel time range, Configuration options, Candlestick options, Color strategy, Open, High, Low, Close, Volume #open-high-low-close, Additional fields, Tooltip mode, Values sort order, Hover proximity, Annotation options, Graph styles options, Style, Line interpolation, Gradient mode, Line style, Show points, Stack series, Bar alignment, Axis options |
| canvas | Plugin information, Elements, Element types, Basic shapes, Metric value, Text, Icon, Server, Button, Add custom images to elements, Connections, Connection adjustments, Connection styles, Canvas editing, Inline editor, Context menu, Configuration options, Canvas options, Inline editing, Experimental Element types, Layer options, Elements (layer), Background (canvas), Border (canvas), Selected element options, Element |
| dashboard-list | Configuration options, Dashboard list options, Query, Folder, Tags |
| flame-graph | Flame graph mode, Menu actions, Focus block, Copy function name, Sandwich view, Grouping, Status bar, Top table mode, Call tree mode, Toolbar, Search, Change color scheme, Configuration options, Frequently asked questions |
| gauge | Configuration options, Value options, Gauge options, Neutral value, Show sparkline, Show thresholds #show-threshold-markers, Text size options #text-size |
| geomap | Configuration options, Map view options, Initial View, Share view, No map repeating, Sync view to dashboard variable, Map layers options, Layer type, Data, Location Mode, Markers layer, Heatmap layer, GeoJSON layer, Night / Day layer, Route layer, Photos layer, Network layer, OpenStreetMap layer, CARTO basemap layer, ArcGIS MapServer layer, XYZ Tile layer, MapLibre Style layer, Basemap layer options, Map controls opt |
| heatmap | Pan and zoom panel time range, Configuration options, Heatmap options, Y-Axis options, Colors options, Mode, Steps, Reverse, Start/end color scale from value, Cell display options, Tooltip mode, Show color scale, Annotation options, Exemplars |
| histogram | Time-series table, Basic numerical table, Configuration options, Histogram options, Bucket offset, Gradient mode |
| logs | Log level, Configuration options, Logs options |
| news | Refresh the news feed, Configuration options, News options |
| node-graph | Nodes dataset, Edges dataset, Data requirements, Nodes, Edges, Node graph navigation, Pan, Zoom, Switch layouts, Hidden nodes, Configuration options, Node graph options, Zoom mode, Layout algorithm, Nodes options, Edges options, Data API, Edges data frame structure, Nodes data frame structure |
| pie-chart | Configuration options, Value options, Pie chart options, Pie chart type, Slice sorting, Labels |
| stat | Single numerical values, Time-series data, Configuration options, Value options, Stat styles, Text mode, Wide layout, Text size |
| state-timeline | Time series data, Pan and zoom panel time range, Configuration options, State timeline options, Page size (enable pagination), Annotation options, Axis options |
| status-history | Single time column with null values, Two time columns without null values, Pan and zoom panel time range, Configuration options, Status history options, Annotation options, Axis options |
| table | Column filtering, Turn on column filtering, Filter column values, Clear column filters, Apply filters from the table, Sort columns, Dataset selector, Nested tables, Configuration options, Table options, Table footer options, Cell options, Cell type, Auto, Colored text, Colored background, Gauge, Sparkline, JSON View, Pill, Markdown + HTML, Image, Actions, Tooltip from field, Styling from field, Apply overrides to nes |
| text | Text visualization editor, Views, Toolbar, Modes, Render query results as text with Handlebars templates, Style content with theme colors, Security and external content, What the frame blocks, Review blocked resources, Allow and Always allow, What an approval allows, Configuration options, Data options, Render mode, Page size |
| time-series | Query1, Query2, Alert rules, Special overrides, Transform override property, Fill below to override property, Pan and zoom panel time range, Configuration options, Series visibility, Axis options, Annotation options, Graph styles options |
| traces | Add a panel with tracing visualizations, Steps #add-the-traces-panel-query, Add TraceQL with table visualizations, Configuration options, Span filters options |
| trend | Configuration options, X axis options, Graph styles options, Axis options |
| xy-chart | Configuration options, XY Chart options, Series mapping, X field, Y field, Show, Line style, Axis options |

Each page also inherits the shared configuration above.

## Editions, from the docs

Page counts by the product tag in each page.

| Tag | Pages |
|---|---|
| cloud+enterprise+oss | 400 |
| enterprise+oss | 96 |
| cloud+enterprise | 53 |
| untagged | 40 |
| cloud | 11 |
| enterprise | 8 |
| oss | 2 |
| alerting+cloud+enterprise+loki+oss | 1 |
| cloud+oss | 1 |

Pages not tagged OSS, so these features are paid or hosted:

**enterprise:** Integrate Grafana with Hashicorp Vault; Encrypt database secrets using Azure Key Vault; Encrypt database secrets using Google Cloud KMS; Encrypt database secrets using AWS KMS; Configure Grafana Enterprise; Configure custom branding; Provisioning RBAC with Grafana; Grafana Enterprise.

**cloud and enterprise:** Manage saved queries using Terraform; Export logs of usage insights; Configure request security; Audit a Grafana instance; Encrypt database secrets using Hashicorp Vault; Manage multi-team access in a single Grafana instance; Configure Team Sync; Configure enhanced LDAP integration; Configure SAML authentication in Grafana; Configure SAML authentication with Microsoft Entra ID; SAML configuration options; Configure SAML with Okta catalog application; Configure SAML authentication with Okta; Troubleshoot SAML configuration; Configure Role and Team sync for SAML; Configure SAML authentication using the Grafana user interface; Configure organization mapping for SAML; Configure SAML signing and encryption; Configure SAML single logout; Configure SAML authentication using the Grafana configuration file; Configure SCIM provisioning; Configure SCIM with Okta; Troubleshoot SCIM provisioning; Manage users and teams with SCIM; Configure SCIM with Entra ID; Recorded queries (deprecated); Grafana Role-based access control (RBAC); Provisioning RBAC with Terraform; Assign Grafana RBAC roles; Create custom Grafana RBAC roles; Grafana RBAC permission actions and scopes; Basic and fixed roles permissions; Troubleshooting RBAC; RBAC configuration options in Grafana; RBAC for app plugins; Plan your Grafana RBAC rollout strategy; Manage Grafana RBAC roles; View server statistics and license; Data source management; Label-based access control (LBAC) for data sources; Create LBAC for data sources rules; Configure LBAC for a Loki data source; Configure LBAC for a Prometheus data source; Create and configure announcement banner; Secrets Management HTTP API; Configure RBAC; Manage access using roles; Configure silence access; Manage access using folders or data sources; Improve alert rule quality with Alert Advisor; Assess dashboard usage; Create and manage reports; Reporting settings.

**cloud:** Grafana Ansible collection; Manage Fleet Management in Grafana Cloud using Terraform; Manage secrets in Grafana Cloud using Terraform; Configure Grafana Cloud authentication; Grafana Cloud app plugin role definitions; Configure LBAC for Tempo or Cloud Traces; Grafana Cloud; Grafana Cloud API; Data source LBAC rules HTTP API; Declare incidents from firing alerts; When SLOs reduce alert noise.

**Reading these:** Grafana's source tree includes only an Enterprise stub in `pkg/extensions`, so paid code is not here. These titles show what exists, not how it works.

## Separate repositories

**Alerting library** (`grafana/alerting`, public). It defines 24 notification channels, more than the 14 with their own docs pages: Alertmanager, DingDing, Discord, email, Google Chat, Jira, Kafka, LINE, MQTT, OnCall, Opsgenie, PagerDuty, Pushover, Sensu Go, Slack, SNS, Teams, Telegram, Threema, VictorOps, Webex, webhook, WeChat and WeCom.

**Elasticsearch** is now a separate public repository, `grafana/grafana-elasticsearch-datasource`, and ships as a bundled plugin in 13.0.2.

## Real connection tests

Run on throwaway services, removed afterwards. Test passwords only.

| Test | Result |
|---|---|
| LDAP sign-in, against a real LDAP server | Pass. Role came from group mapping (Editor), and a wrong password returned 401 |
| OAuth sign-in, full browser-style flow through a real identity provider | Pass. New user created as Viewer |
| PostgreSQL 16: health check and query | Pass, 9 ms |
| MySQL 8.4: health check and grouped query | Pass, 25 ms |
| Prometheus: health check and live metric | Pass, 10 ms |
| Stored data source password returned by the API | No, only a flag |
| **`DELETE` sent through the PostgreSQL data source** | **It ran and emptied the table** |

**Key finding:** Grafana relied on the database user's rights, so a user with write access could delete data from the query path. Paarvix must keep its read-only transaction and `SELECT` check, and this is worth saying in sales material. The test user had full rights, which Grafana's docs warn against.

## Limits

- **Paid code:** Enterprise and Cloud code is not public, and Enterprise features need a licence key. SAML and SCIM are in that group, so they are described from Grafana's docs and were not run. A Grafana Labs trial or licence is the only way to test them.
- **Elasticsearch, Loki, Tempo and cloud sources:** listed, but not connected to a real system.
- **Names only:** a name shows a feature exists, not how it behaves.
- **Docs lag:** option headings come from documentation, which can trail the code.
- **Other languages:** translations were counted, not reviewed.
