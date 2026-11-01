# 1. Architecture

## Packaging [O]

| Item | Value |
|---|---|
| Image size | 352 MB compressed-layer total as reported by Docker (`352049768` bytes) |
| Server binary | 452.7 MB on disk, one Go executable |
| Frontend | `public/` 528 MB, of which `build/` 387 MB and 1,584 entries |
| Bundled plugin downloads at first start | 29.6 MB in `/var/lib/grafana/plugins` |
| Default DB | SQLite, 1.5 MB when new |
| Container user | UID 472, not root |
| Commands | `grafana server`, `grafana cli plugins`, `grafana cli admin` |

**Memory [O]:** 147–200 MiB soon after start, on a small lab. This is not a measurement under load.

**Path layout [O]:** separate env paths for config, data, home, logs, plugins and provisioning (`GF_PATHS_*`).

## Internal structure

- **[O]** One process runs many background modules; logs show a service manager starting items such as usage stats and stats collection.
- **[O]** About 85 database tables; schema migrations run and log at every start.
- **[O]** Two storage systems coexist: classic tables, plus generic `resource`, `resource_history`, `resource_blob` and `resource_version`.
- **[O]** `/apis` exposes Kubernetes-style versioned groups, for example `dashboard.grafana.app v2`, `folder.grafana.app v1`, `playlist.grafana.app v1`, `rules.alerting.grafana.app v0alpha1`.
- **[O]** Migration-log tables and dual storage indicate a long move to the resource model, not a finished one.

## Key dependencies [O]

544 modules from build metadata. Purpose below is inferred from each library:

| Library | Purpose |
|---|---|
| `k8s.io/apiserver` 0.35.1 | Resource APIs |
| `openfga` 1.14.2 | Relationship authorization |
| `prometheus/alertmanager` 0.28.2 | Alert routing |
| `centrifuge` 0.38.0 | Live messaging |
| `arrow-go` 18.5.2 | Columnar data |
| `go-plugin` 1.7.0 | Out-of-process plugins |
| `bleve` 2.5.7 | Search index |
| `go-ldap` 3.4.4 | LDAP |
| `cel-go` 0.28.0 | Expression rules |
| `open-feature` 1.17.1 | Feature flags |

## Scale-related config [O]

- `[database]`: SQLite by default; MySQL/Postgres via `type`; `high_availability = true`.
- `[remote_cache] type = database` by default.
- `[live] ha_engine` for multi-instance realtime.
- `server_lock` table for job coordination.
- `[grpc_server]`, `[unified_storage]` for split deployments.

## Takeaway [R]

Grafana's weight comes from a decade of features and two storage models. Paarvix's Node-based stack will not match its idle memory automatically, so measure against the 512 MB budget early, and choose one storage model now.
