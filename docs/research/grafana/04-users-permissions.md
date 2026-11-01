# 4. Users and Permissions

## Hierarchy [O]

```
Server (Grafana Admin)
 └─ Org: isolated dashboards, sources, teams
     ├─ Org role per user: Viewer / Editor / Admin
     ├─ Teams
     └─ Folders → dashboards
Service accounts: machine identities with a role, stored in `user`
```

A user can have different roles in different orgs: `uViewer` was Viewer in org 1 and added as Editor in org 2.

Defaults: sign-up off, org creation off, auto-join org 1 as Viewer.

## Permission counts [O]

| Role | Distinct actions |
|---|---|
| Viewer | 24 |
| Editor | 66 |
| Admin (also server admin) | 178 |

The admin figure is for `admin`, who is also server admin, so a plain org Admin may have fewer.

Format is `resource:verb`, e.g. `datasources:query`, `folders:read`, `alert.rules:write`.

- **Viewer includes:** `datasources:query`, `datasources:read`, `folders:read`, `alert.rules:read`, `annotations:read`, `snapshots:read`.
- **Editor adds:** `dashboards:create`, `datasources:explore`, `folders:create`, `alert.rules:*`, receiver and template writes, `annotations:*`.
- **Admin-level adds:** `datasources:create/write/delete`, dashboard and folder permissions, LDAP, feature flags, provisioning, plugins, users.

## Folder permissions [O]

- New folder: Editor = Edit, Viewer = View.
- After clearing the list, Viewer got **403** on a dashboard inside.
- Levels are numeric: 1 View, 2 Edit, 4 Admin.

## The key gap [O]

After the folder was locked, the same Viewer could still `POST /api/ds/query` with **custom SQL** and got results (`count = 200`). Hiding a dashboard does not hide the data.

Per-data-source permissions returned **404** on OSS (`/api/access-control/datasources/<uid>`), and custom roles too. So in OSS, any Viewer in an org can query any data source of that org.

**Workarounds:** separate orgs per department, or separate read-only DB users per data source, though any Viewer in the same org still reaches all of them. Orgs are the real boundary in OSS.

Row-level security was not found in the config or tested. [K] It is not a native feature.

## Open-core boundary [O]

Present in the spec but unavailable or unproven on OSS: custom roles, data-source permissions, `reports`, `licensing`, `groupsync`. `enterprise`-tagged API operations: 70.

The engine is shared; paid editions unlock management of it.

## Lifecycle features [O]

Invites (24h), email verification (1h), quotas (off by default), `/api/admin/stats` with active and daily user counts, external users flagged `isExternal`, hidden users config.

## For Paarvix [R]

- Never give Viewers a raw-query permission. Separate `query:saved` from `query:raw`.
- Query authorization must follow the dashboard: viewing a panel permits that panel's query only.
- Include data-source permissions in Community; that is a security basic for a college.
- Row-level rules for HODs remain the Pro differentiator.
- Keep `resource:verb` naming, with a fixed role map at P1.
