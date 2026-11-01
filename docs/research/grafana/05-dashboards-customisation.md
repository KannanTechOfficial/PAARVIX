# 5. Dashboards and Customisation

## Dashboard model [O]

JSON: `title`, `uid`, `version`, `panels[]`, `templating`. Each panel has `type`, `title`, `gridPos {h,w,x,y}`, `datasource`, `targets[]`. A read adds `meta`: `canEdit`, `canSave`, `canDelete`, `provisioned`, `version`, folder info.

API versions exist up to `dashboard.grafana.app v2`, and samples include `dashboard-v2alpha1.json`, so the JSON schema is evolving.

## Versioning [O]

This corrects the earlier report's "unconfirmed".

| Action | Result |
|---|---|
| Save changes | Version 1 → 2 → 3, each with a save message |
| Save with stale version | Rejected: `version-mismatch`, "changed by someone else" |
| Restore v1 | Creates a new version 4; history is kept |
| Save with no change | Version stayed the same |

Optimistic locking prevents silent overwrites. Works in OSS.

## Builder UI [O]

New dashboard screen, reviewed from a screenshot:
- Side panel: add Panel, group into rows or tabs, add Variable, Annotation query, Link.
- Layout choice: **Auto grid** or **Custom grid**.
- Top bar: time range, refresh, Save, Exit edit.
- Sidebar: Home, Starred, Dashboards, Explore, Drilldown, Alerting, Connections, Administration.
- `Ctrl+K` search.

The home page offers a tutorial and "Add your first data source". No sample data is ready to view.

## Panels [O]

27 bundled: timeseries, barchart, bargauge, stat, gauge, table, piechart, heatmap, histogram, xychart, trend, candlestick, state-timeline, status-history, geomap, canvas, nodeGraph, flamegraph, traces, logs, text, alertlist, annolist, dashlist, news, gettingstarted, welcome.

Panel `plugin.json` has `suggestions`, tied to the suggested-visualisation feature flags.

## Reuse and sharing [O]

| Feature | Tested result |
|---|---|
| Library panels | Created via API with version 1; use across dashboards not tested |
| Snapshots | API responded with only `message, traceID`, so creation with our payload is **unconfirmed** |
| Short URLs | Returned `uid`, `url` |
| Annotations | Created with text, tags, time |
| Public dashboards | No-login token URL; panel query runs from server-held definition |
| Playlists | API exists; not tested |

## Plugins [O]

- Types: panel, data source, app.
- 51 bundled `plugin.json` files; 46 plugins listed at runtime after startup installs.
- Controls: signature checks, `allow_loading_unsigned_plugins`, `disable_plugins`, `preinstall`, `update_strategy = minor`, sandbox flag off by default, restricted API lists.
- Catalogue in the UI, served from grafana.com.

## Languages [O]

`public/locales`: cs, de, en, es, fr, hu, id, it, ja, ko, nl, pl, pt-BR, pt-PT, ru, sv, tr, zh-Hans, zh-Hant. **No Tamil, Hindi or any other Indian language.**

## Branding [O]

`default_theme`, `default_language`, `home_page`, navigation sections. Logo and app name changes were not found in OSS config; [K] white-label is paid.

## Not covered

Variables, overrides, thresholds and transformations were not exercised. See README limits.

## For Paarvix [R]

- Adopt optimistic version checks and "restore creates a new version".
- Dashboard JSON needs a schema version from day one.
- Start empty, and point clearly to Templates (founder decision, 2026-11-01).
- Offer Auto grid as default: non-experts should not position panels.
- Tamil is a real differentiator; ship it in P1.
