# 2. Connectors and Data Flow

## Available sources [O]

**Bundled at start:** alertmanager, azure-monitor, cloudwatch, stackdriver, pyroscope, graphite, influxdb, jaeger, loki, mssql, mysql, opentsdb, parca, postgresql, prometheus, tempo, testdata, zipkin. **Virtual:** Dashboard, Grafana, Mixed.

**Installed from the network at first start:** elasticsearch and four drilldown apps.

**Online catalogue:** Connections → Add new connection is a searchable plugin list, including third-party sources; some carry an "Enterprise" badge (seen: Adobe Analytics, Amazon Aurora).

**Plugin metadata fields [O]** (Prometheus `plugin.json`): `alerting`, `annotations`, `backend`, `category`, `id`, `info`, `metrics`, `multiValueFilterOperators`, `name`, `queryOptions`, `routes`, `type`. These are capability flags, like Paarvix's `ConnectorCapabilities`.

**Signatures [O]:** 45 plugins `internal`, 1 `valid`.

## Lifecycle [O]

| Step | Route | Result |
|---|---|---|
| Create | `POST /api/datasources` | `jsonData` is plain; `secureJsonData` is secret; server issues `uid` |
| Read | `GET /api/datasources/uid/<uid>` | Secret absent; `secureJsonFields: {password: true}` |
| At rest | `data_source.secure_json_data` | Encrypted value |
| Health | `.../health` | Friendly status; Prometheus also lists features |
| Metadata | `.../resources/...` | Plugin-defined pass-through |

## Query path [O]

```
POST /api/ds/query  {from, to, queries:[{refId, datasource:{uid}, ...plugin fields}]}
  -> caller authenticated, datasources:query checked
  -> settings and secret loaded on server
  -> macros and time range applied
  -> plugin queries the source
  -> {results:{A:{status, frames:[...]}}}
```

Each query has a `refId`, and one request can hold several queries.

## Data frame [O]

```json
{"schema":{"refId":"A","meta":{"executedQueryString":"select ..."},
  "fields":[{"name":"dept","type":"string","typeInfo":{"frame":"string","nullable":true}},
            {"name":"a","type":"number","typeInfo":{"frame":"float64","nullable":true}}]},
 "data":{"values":[["CSE","ECE","MECH"],[66.8,67.4,68.4]]}}
```

- Columns, not rows; compact and chart-friendly.
- Field has a display type and an exact storage type.
- Time series add `meta.type: timeseries-multi` and per-field `labels`.
- The executed SQL comes back to the caller.
- `Accept: application/vnd.apache.arrow.stream` on this route still returned JSON.

## Macros [O]

| Macro | Became |
|---|---|
| `$__timeFilter(ts)` | `ts BETWEEN '<from>' AND '<to>'` |
| `$__timeGroup(ts,'1d')` | `floor(extract(epoch from ts)/86400)*86400` |

The time values are written into the SQL text.

## Expressions [O]

A query with datasource `__expr__` runs on the server over earlier refIds: `reduce` and `threshold` tested. Alerts reuse the same mechanism.

## SQL safety [O]

| User in DB | `delete from marks` | Result |
|---|---|---|
| Superuser | Admin via `/api/ds/query` | **Rows deleted** |
| Read-only role | Admin via same route | Blocked by Postgres: `permission denied` |

Safety therefore rests on the database account, not Grafana.

## Proxy limits [O]

`[dataproxy]`: timeout 30s, dial 10s, `response_limit = 0` (no limit), `[query] concurrent_query_limit` empty.

## Gaps [O]

No bundled Excel, CSV upload, Google Sheets, SQLite or REST/JSON source. The online catalogue was not searched for each, so plugins may exist.

## For Paarvix [R]

- Keep the settings/secrets split and write-only secrets.
- Support several queries per request with IDs.
- Return column-based frames with exact types.
- Enforce read-only in the server as well as the DB.
- Use bind parameters for macros, not text insertion.
- Set non-zero response limits by default.
