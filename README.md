<div align="center">

# Paarvix

### See your data clearly.

**Open-source, self-hosted data dashboards for colleges, hospitals, shops, factories and growing companies.**
Connect Excel, Google Sheets, MySQL or PostgreSQL on your own server, with no data team and no per-user fees.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](docs/roadmap.md)
[![Built with Angular](https://img.shields.io/badge/Angular-22-dd0031.svg)](https://angular.dev)
[![Built with NestJS](https://img.shields.io/badge/NestJS-12-e0234e.svg)](https://nestjs.com)

[Get started](docs/guide/getting-started.md) · [Connect your data](docs/guide/connecting-data.md) · [Roadmap](docs/roadmap.md) · [Sectors](docs/guide/sectors-and-customising.md)

![Paarvix Data Sources page previewing a made-up sales workbook](docs/assets/data-sources.png)

</div>

> **Status: early alpha.** Connecting and previewing data works today. The dashboard builder is the next stage. Please try it with made-up data, and don't rely on it for production yet.

## What is Paarvix?

Paarvix is an open-source analytics platform that reads the data an organisation already has and shows it clearly. It runs on your own server, so your data stays with you.

The name comes from the Tamil word *paarvai* (பார்வை), meaning vision, plus *x* for technology.

It is built for people who need answers but don't have a data team: a principal checking attendance, an owner checking daily sales, a manager checking stock.

## What works today

- **Excel:** upload `.xlsx` files up to 50 MB. Every sheet becomes a table.
- **Google Sheets:** link public or private sheets, with scheduled refresh. Still to be tried against real Google.
- **MySQL, MariaDB and PostgreSQL:** read live, inside read-only transactions.
- **Preview:** see tables, column types and the first rows.
- **Indian formats:** `₹1,25,000` is read as a number, `15-08-2026` as day first, and phone numbers and codes like `00123` stay exact.
- **Tamil:** Tamil sheet names, column names and interface text.
- **Roles:** Admin, Editor and Viewer, checked on the server.

## Built to be safe with your data

- **Read-only by design.** Queries run in a read-only transaction with a 30-second limit and a 10,000-row cap.
- **No raw SQL on imported files.** Spreadsheet data can only be reached through a checked query path.
- **Secrets stay secret.** Data source passwords and keys are encrypted and never returned by the API.
- **Bad files stay contained.** Imports run in a separate process with memory and time limits, so a bad file cannot take the server down.
- **You own it.** It runs on your hardware, with no telemetry.

Found a security issue? See [SECURITY.md](SECURITY.md).

## Quick start

You need Docker on Linux.

```bash
git clone https://github.com/KannanTechOfficial/PAARVIX.git
cd PAARVIX
./install.sh
```

The installer creates random secrets and starts Paarvix. Open the address it prints, create your admin account, then go to **Data Sources**.

Lifecycle commands: `./run.sh status`, `./run.sh logs`, `./run.sh stop`.

## Where it's going

| Stage | What you get | Status |
|---|---|---|
| 1. Data connections | Excel, Google Sheets, MySQL, PostgreSQL | In progress |
| 2. Dashboard builder | Drag-and-drop dashboards, charts and filters | Planned |
| 3. Sector packs | Ready-made dashboards for education, finance, sales, stock and HR | Planned |
| 4. Alerts and roles | Threshold alerts by email, and analyst roles | Planned |
| 5. ERP connectors and AI | Tally, Zoho, ERPNext, and questions in English and Tamil | Planned |

See the full [roadmap](docs/roadmap.md).

## How is Paarvix different?

Paarvix aims for a gap between tools that are powerful but technical and tools that are simple but closed. The goals below are our direction, not all finished yet.

| Goal | What it means |
|---|---|
| Start from a spreadsheet | Excel first, databases when you're ready |
| Start from your sector | Ready-made dashboards instead of a blank page |
| Local first | Indian formats and Tamil from day one |
| Small footprint | One-command install, targeting a 2 GB server |
| Free core, forever | The Community edition stays free under AGPLv3 |

## FAQ

**Is Paarvix free?**
Yes. The Community edition is free and open source under AGPLv3. Paid options such as setup, support and Pro features are planned.

**Is it a Grafana or Metabase replacement?**
Not yet. Paarvix is in early alpha and has no dashboard builder so far. Both are mature products. Paarvix focuses on non-technical users, spreadsheets and sector templates.

**Is it an ERP?**
No. Paarvix doesn't replace your accounting or ERP software. It reads their data and shows it clearly.

**Does my data leave my server?**
No. Paarvix is self-hosted. Google Sheets sources are fetched from Google, and imported copies stay on your server.

**Can it change my data?**
No. Paarvix only reads. We still recommend connecting with a read-only database user, as [the guide](docs/guide/connecting-data.md) explains.

**Does it support Tamil?**
Yes, in the interface and in your data. English and Tamil come first, with more languages planned.

## Development

```bash
npm install
cp .env.example .env   # then set long random secrets
npm run dev:api
npm run dev:web
```

Paarvix uses Angular, NestJS with Fastify, Prisma and PostgreSQL. To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Paarvix Community is licensed under the [GNU AGPL v3.0](LICENSE). Commercial licenses are available from paarvix@kannantech.com.

"Paarvix" and "KannanTech" are trademarks. See [TRADEMARK.md](TRADEMARK.md).

---

Built in India by [KannanTech](https://kannantech.com).
