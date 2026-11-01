# 7. Operations and Config

## Configuration [O]

- `conf/defaults.ini`: 113 sections, about 99 KB. `/api/admin/settings` returned 135 sections at runtime.
- Overrides: `/etc/grafana/grafana.ini` and `GF_<SECTION>_<KEY>` env vars. Env overrides tested for auth, security and anonymous settings.
- Feature flags: 64 on in `/api/frontend/settings`, controlled by `[feature_toggles]`.

## Provisioning [O]

`conf/provisioning/` samples: `datasources`, `dashboards`, `alerting`, `access-control`, `plugins`. YAML with `apiVersion`. Files can add and delete resources, and resources show as `provisioned`.

Newer Git-style sync: `provisioning.grafana.app`, `[provisioning]` with `max_repositories = 10`, `min_sync_interval = 10s`; 31 API operations tagged `provisioning`. Not tested.

## Outbound calls by default [O]

| Setting | Default |
|---|---|
| `reporting_enabled` | true |
| `check_for_updates` | true |
| `check_for_plugin_updates` | true |
| Plugin preinstall | Downloaded at first start |
| Home page news | Fetched blog post |

Paarvix's opt-in rule (§9.14) is stricter.

## Observability [O]

`/metrics` Prometheus endpoint with 2,686 `grafana_` lines, needs no special setup. OpenTelemetry config. `[support_bundles]` on, server admin only. `/api/admin/stats` gives usage. Admin **Advisor** health checks (`advisor.*` permissions).

## API [O]

`public/api-merged.json`: 212 paths. Operation counts by tag include: enterprise 70, provisioning 31, dashboards 25, access_control 25, datasources 20, signed_in_user 16, org 15, orgs 14, convert_prometheus 14, migrations 13, reports 13, teams 12, admin_users 11, annotations 10. There is also `openapi3.json`, and Swagger UI at `/swagger`.

## Security headers [O]

Present: `X-Frame-Options: deny`, `X-Content-Type-Options: nosniff`, `X-Xss-Protection`, `Cache-Control: no-store` on login. No `Content-Security-Policy` by default. Embedding is off by default.

## Limits [O]

Live: 100 connections, 8 MB messages. Render: 30 concurrent. Quotas off. `short_links expire_time = -1`.

## Backup

`grafana.db` holds everything by default, along with plugins in the data directory. The `secret_key` must be preserved or stored secrets cannot be decrypted [K].

## For Paarvix [R]

- Single config precedence: defaults → file → env.
- Ship `/metrics`, a support bundle and a health page.
- Telemetry and update checks stay off until opted in.
- Publish OpenAPI from day one.
- Add `paarvix backup` that includes keys with a clear warning.
