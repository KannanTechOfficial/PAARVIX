# Roadmap

Paarvix is built in stages. Each stage gives users something they can use, and has its own design and plan.

| Stage | What you get | Status |
|---|---|---|
| **1. Data connections** | Connect Excel, Google Sheets, MySQL and PostgreSQL safely | In progress |
| **2. Dashboard builder** | Drag-and-drop dashboards, charts, filters and date ranges | Planned |
| **3. Sector packs** | Ready-made Finance, Sales, Inventory, Purchasing, HR and Education dashboards, with column matching | Planned |
| **4. Alerts and roles** | Threshold alerts by email, and analyst, editor and viewer roles | Planned |
| **5. ERP connectors and AI** | Tally, Zoho and ERPNext connectors, and questions in plain English and Tamil | Planned |

## Before the first paying client

- **Safe upgrades:** installs currently update their database structure with `prisma db push --accept-data-loss`, which could delete data during an upgrade. This must move to `prisma migrate deploy`.
- **Row-level access:** a rule such as "a manager sees only their branch" is planned. The query path is ready for it, but no rules exist yet, so Editors can see all data in a source.

## Later

Cloud hosting, plugin marketplace, real-time streams and more languages follow the phases in `CLAUDE.md`.
