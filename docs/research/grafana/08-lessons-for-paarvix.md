# 8. Lessons for Paarvix

All recommendations here are design opinions based on docs 1–7. Implement each in our own way.

## Rebuild the idea

| Idea | Where | Priority |
|---|---|---|
| Settings/secret split, write-only secrets | M1 | Critical |
| `resource:verb` permissions under fixed roles | M1 | Critical |
| Org-scoped resources | M1 | Critical |
| Optimistic versioning, restore as new version | M1 | High |
| Provenance on resources | M1 | High |
| Session list with device info | M1 | High |
| Cross-origin rejection on cookie POST | M1 | Critical |
| Connector create/health/metadata/query flow | M2 | Critical |
| Column frames with exact types | M2 | Critical |
| refId-based multi-query | M2 | Medium |
| Public links with server-held queries | M3 | High |
| Library panels, playlists | M4 | Medium |
| OIDC + PKCE with claim mapping | M4 | High |
| Provisioning files, schema versions | M4 | Medium |
| `/metrics`, support bundle, advisor | M4 | Medium |
| Alert pipeline with history | M4+ | Medium |

## Do differently

| Grafana behaviour | Paarvix rule |
|---|---|
| Viewer holds `datasources:query`, can run custom SQL | Viewers run saved queries only |
| Folder lock does not protect data | Authorize query by dashboard |
| No per-source permissions in OSS | Include in Community |
| Read-only depends on DB account | Server validator **and** read-only account |
| Lockout gives a generic error, can lock out admin | Clear locked state, username + IP limit |
| `admin/admin`, shared secret key | Forced password, generated keys |
| Proxy header trusted without whitelist by default | Refuse to start without trusted list |
| New alert notifies nobody | Recipient required |
| Telemetry and downloads on by default | Silent by default |
| Two storage generations | One resource model |
| Time values inserted into SQL text | Bind parameters |

## Gaps to win

1. **Excel and CSV first**, in-product.
2. **Ready-made templates, one click from an empty start.**
3. **Tamil, then Hindi and other Indian languages.** None are bundled.
4. **WhatsApp alerts.** Not in the channel list.
5. **Department-level security** without separate orgs.
6. **Education templates.**
7. **Ask in plain language**, shown with SQL.
8. **Lakh/crore and ₹** by default.

## Do not chase

Log, trace and profile tooling; 100+ data source catalogue; Kubernetes-style API; Alertmanager-grade routing; high-cardinality monitoring.

## Effect on the master plan

- Add **data-source permissions in Community** and a `query:saved` vs `query:raw` split to F2/F8. **Founder decision:** this is a scope addition.
- Default the alert wizard to require a recipient.
- Move Tamil from "later" thinking to a P1 must-have, as already in the brief.
