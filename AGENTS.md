# PAARVIX — Advanced Master Agent Brief (v2)

> **Every AI agent and contributor must read this file fully before writing code.** It replaces v1. Save it in the repo root as `AGENTS.md` and copy it as `CLAUDE.md`. If any request conflicts with this file, stop and ask.
>
> **Business context** (pricing, market and growth plans) is private, in `CLAUDE.local.md`. It is git-ignored and must never be committed.
>
> **How to read it:** Paarvix is designed to grow into a world-class platform, and it must stay simple enough for a small team to maintain. Every advanced feature below has a **phase tag** (P0–P5). Build strictly in phase order. Design the architecture *now* so advanced features can plug in *later* without rewrites.

---

## 0. TL;DR for agents

- **What:** Paarvix is an open-source, AI-native, real-time **data visualisation, analytics and observability platform**, built with **Angular + NestJS**. Long-term ambition: the most powerful *and* the simplest open dashboard platform in the world.
- **Five pillars:** **Simple · Intelligent · Real-time · Extensible · Secure.**
- **Absolute rules:** never commit secrets; never put Pro code in public repo; never copy competitors' code/assets/names; never move a free feature to paid; Community must run fully on **2 GB RAM / 1 vCPU** with one command.

---

## 1. Identity & Brand

| Item | Value |
|---|---|
| Name | **Paarvix** ("PAAR-vix") — Tamil *Paarvai* (பார்வை, vision) + *x* (tech) |
| Story | "Paarvai means vision. Paarvix gives you a clear vision of your data." |
| Tagline | **See your data clearly.** · Secondary: "From data to decisions, instantly." |
| Company | KannanTech — https://kannantech.com |
| Contacts | paarvix@kannantech.com · security@kannantech.com |
| GitHub | `KannanTechOfficial/PAARVIX` (public) · `KannanTechOfficial/paarvix-pro` (private) |
| npm | `@paarvix/*` |
| Palette | Deep blue `#1E3A8A`, teal `#14B8A6`, orange `#F97316`, slate neutrals; full dark theme |
| Fonts | Inter (UI), JetBrains Mono (code/SQL), Poppins (marketing) |
| Logo | An eye whose iris is a chart; or a lens-shaped "P" with a line graph |
| Voice | Clear, confident, helpful; zero jargon for end users |

---

## 2. Vision, Mission, Principles

**Vision (10-year):** Any person, in any language, can ask a question of any data and *see* the answer instantly — on their own server, for free.

**Mission (now):** The simplest open-source dashboard platform that becomes more powerful as you grow: upload Excel → dashboard in 2 minutes → connect databases, streams and AI when you're ready.

**Principles (tie-breakers, in order):**
1. **Progressive power.** Simple by default; advanced on demand. A principal and a data engineer use the same product at different depths.
2. **Templates & AI before blank canvas.** Nobody starts from an empty screen.
3. **Own your data.** Self-hosting, offline/LAN, air-gapped mode are first-class. AI can run locally.
4. **Secure & private by default.**
5. **Fast everywhere.** Sub-second interactions; works on a cheap phone and a 4K TV wall.
6. **Extensible core.** Everything (connectors, panels, transforms, alert channels, AI providers) is a plugin.
7. **Local-first, global-ready.** INR, Indian formats, Tamil/English first; i18n for 20+ languages later.
8. **Free core stays free, forever.**

---

## 4. Personas

| Persona | Depth | Key need |
|---|---|---|
| Principal / CEO / Owner | Viewer | Phone glance, AI summary, alerts on WhatsApp |
| HOD / Manager | Analyst-lite | Upload data, filter, ask questions |
| Data analyst | Analyst | SQL, transforms, semantic models, notebooks |
| IT admin / DevOps | Operator | Install, SSO, backups, scaling, monitoring |
| Developer / ISV | Builder | Embed SDK, API, plugins |
| Agency / reseller | Partner | White-label, multi-tenant |
| IoT / Ops engineer | Real-time | Streams, metrics, alerting |
| Open-source contributor | Builder | Clear architecture, plugin SDK |

---

## 6. Licensing & IP (mandatory)

- Public `paarvix`: **AGPLv3**, header on every source file:
  ```
  /*
   * Paarvix — See your data clearly.
   * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
   * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
   * Commercial licenses: paarvix@kannantech.com
   */
  ```
- Private `paarvix-pro`: proprietary. Never published or copied into public.
- **Plugin SDK** (`@paarvix/plugin-sdk`) and **embed SDK client**: **MIT** — so third parties can build paid plugins and embed without AGPL fear (grows the ecosystem and the marketplace).
- Root files: `LICENSE`, `COMMERCIAL-LICENSE.md`, `TRADEMARK.md`, `NOTICE`, `CONTRIBUTING.md` (CLA via CLA Assistant), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `CHANGELOG.md`, `THIRD_PARTY_LICENSES.md`, `.env.example`.
- Allowed dependency licenses: MIT, Apache-2.0, BSD, ISC, MPL-2.0, AGPL/GPL-compatible. Forbidden: proprietary, non-commercial, SSPL, BSL, unknown. CI runs a license checker.
- "Paarvix" and "KannanTech" names/logos are trademarks; forks may not use them.

---

## 7. Feature Specification (by module, with phases)

### 7.1 Onboarding & UX
- First-run wizard → admin → "Try sample College dashboard" / "Upload Excel" / "Connect DB". **Dashboard in < 2 minutes.** *(P1)*
- **Command palette** (Ctrl/Cmd+K) for everything: open dashboard, run query, ask AI, change theme. *(P1)*
- Keyboard shortcuts, undo/redo across builder. *(P1)*
- Guided tours, contextual help, empty states with templates. *(P1)*
- **PWA**: installable, offline viewing of cached dashboards. *(P2)*
- **TV/Kiosk mode**: playlists rotating dashboards, auto-refresh, 4K layouts. *(P2)*
- Accessibility: WCAG 2.2 AA, screen-reader data tables for every chart, colour-blind palettes. *(P1)*

### 7.2 Data Connectivity (plugin-based)
- **P1:** CSV, Excel (multi-sheet), Google Sheets, MySQL/MariaDB, PostgreSQL, SQLite, REST/JSON, static JSON.
- **P2:** SQL Server, Oracle, MongoDB, Prometheus, InfluxDB, Elasticsearch/OpenSearch, ClickHouse, GraphQL, Airtable, Supabase, Firebase.
- **P3:** BigQuery, Snowflake, Redshift, Databricks, S3/Parquet files, Kafka, MQTT (IoT), WebSocket, webhooks (push), Google Analytics, Razorpay/Stripe, college ERP adapters.
- **P4:** Change-data-capture, federated queries across sources, connector marketplace.
- Every connector: `testConnection`, `discoverSchema`, `query(QuerySpec)`, optional `stream(subscription)`, capability flags (supportsPushdown, supportsStreaming, supportsWrite=false).
- Credentials encrypted (AES-256-GCM, envelope encryption, key rotation). Optional **SSH tunnel** and **TLS client certs**.

### 7.3 Query & Transformation Engine
- **No-code query builder** (P1): fields → filters → group → aggregate → sort → limit → joins (P2).
- **SQL editor** (P1): Monaco editor, autocomplete from schema, formatting, query history, saved snippets, read-only enforcement, timeouts, row limits.
- **Transform pipeline** (P2): visual steps — filter, rename, cast, compute column, pivot/unpivot, join datasets, merge, window functions, moving average, percent-of-total, rank, outlier removal, date bucketing.
- **In-browser engine** (P2): **DuckDB-WASM** for fast local analytics on uploaded files (zero server load; fits low-budget hosting).
- **Server engine** (P2): push down to source when possible; otherwise DuckDB on server for joins across sources.
- **Caching** (P1 memory → P2 Redis/disk): smart TTL, cache warming for scheduled dashboards, invalidation on data upload.
- **Semantic layer** (P3): define metrics once ("Pass %", "Attendance %", "Revenue") with dimensions and business names; reused across dashboards, AI and API. YAML-as-code + UI.
- **Query cost guard** (P3): estimate cost, warn/block expensive queries, per-user quotas.

### 7.4 Visualisation (20+ panel types)
- **P1:** line, area, bar (grouped/stacked/horizontal), pie/donut, table (sortable, paginated, virtual scroll), KPI/stat with sparkline & delta, gauge, heatmap, text/markdown, image, iframe (allow-listed).
- **P2:** scatter/bubble, combo (bar+line, dual axis), funnel, treemap, sunburst, sankey, radar, box plot, histogram, waterfall, calendar heatmap, pivot table (with subtotals), progress/bullet, timeline/Gantt, choropleth & point maps (India states/districts built-in), word cloud.
- **P3:** **WebGL** charts for 1M+ points, real-time streaming charts, 3D surface (opt-in), network graph, custom panels via plugin SDK, **Vega-Lite** spec panel for power users.
- Panel features: conditional formatting, thresholds, value mappings, drill-down (click → filtered dashboard/detail), cross-filtering between panels, linked tooltips & crosshair sync, annotations, comparisons (vs previous period/target), units & Indian lakh/crore formatting, export (PNG/SVG/CSV/XLSX).

### 7.5 Dashboards
- Responsive drag-and-drop grid, rows/sections, collapsible groups, tabs. *(P1)*
- Variables & filters: date range (relative/absolute), dropdown (static/query-driven), cascading filters, URL-synced state. *(P1)*
- **Dashboards-as-code**: JSON/YAML export/import, Git sync (pull/push to a repo), diff view. *(P2)*
- Versioning with restore & compare. *(P2 Pro)*
- **Drill-through** to detail dashboards with context. *(P2)*
- **Story mode / presentations**: turn a dashboard into narrated slides. *(P3)*
- Public & password-protected sharing, expiring links, embed iframe. *(P1)*

### 7.6 AI Layer — "Paarvix Intelligence" (AI-native, provider-agnostic)
- **Provider abstraction** (P2): OpenAI-compatible APIs, Anthropic, Google, and **local models via Ollama / llama.cpp** for offline/private use. BYO key free in Community; hosted credits paid.
- **Ask in plain language** (P2): "Show pass percentage by department for last semester" → generates query + chart. **English and Tamil** first. Uses the semantic layer and schema metadata; shows generated SQL for transparency; read-only always.
- **Auto-dashboard** (P2): upload a file → AI detects column types and proposes a full dashboard.
- **AI insights / narratives** (P3 Pro): automatic summary under each dashboard ("Attendance in CSE dropped 8% this week, mainly 2nd year").
- **Anomaly detection** (P3 Pro): statistical (z-score, seasonal decomposition) first; ML optional. Feeds alerts.
- **Forecasting** (P3 Pro): trend lines and forecasts (e.g., fee collection, sales) with confidence bands.
- **Explain this chart** (P3): one-click explanation for non-technical viewers.
- **AI chart/design assistant** (P3): "make this cleaner", "suggest better chart".
- **AI agent / MCP server** (P4): Paarvix exposes an **MCP server** and API so external AI agents can query data, create dashboards and read insights with permissions.
- **Guardrails:** AI never sees data the user can't see (RLS applied first); PII redaction option; prompts and outputs logged in audit (Pro); configurable "never send data off-server" mode.

### 7.7 Real-time & Observability Mode
- Live panels via **WebSocket/SSE** with backpressure and downsampling. *(P3)*
- Streaming sources: MQTT, Kafka, webhooks, WebSocket. *(P3)*
- Time-series storage option for small deployments (TimescaleDB / DuckDB) *(P3)*, plus Prometheus/Influx as external sources *(P2)*.
- Ops templates: server metrics, website uptime, API latency, IoT sensors. *(P3)*

### 7.8 Alerting & Automation Engine
- Rules on any query/metric: thresholds, % change, no-data, anomaly (AI). *(P2 basic, P3 advanced)*
- Channels: email *(P1)*; **WhatsApp**, Telegram, Slack, Teams, SMS, webhook, push notification *(P2 Pro)*.
- Escalation policies, silences, on-call schedules, grouping & deduplication. *(P3)*
- **Scheduled reports**: PDF/PNG/XLSX by email/WhatsApp; branded. *(P2 Pro)*
- **Workflow automation** (P4): trigger → condition → action (e.g., attendance < 75% → notify HOD + mentor list). Webhook-in/out, Zapier/n8n compatible.

### 7.9 Collaboration
- Comments & @mentions on panels, threaded. *(P3 Pro)*
- Real-time co-editing of dashboards (CRDT via Yjs). *(P4)*
- Activity feed, favourites, recently viewed, personal home page. *(P2)*
- Annotations on time series (events like "exam week"). *(P2)*

### 7.10 Governance, Security & Admin
- Users, teams, roles: admin/editor/analyst/viewer *(P1)*; custom roles & granular permissions *(P2 Pro)*.
- **Row-level & column-level security** (e.g., HOD sees own department, salary column hidden). *(P2 Pro)*
- SSO: Google, Microsoft, OIDC, SAML; **SCIM** provisioning. *(P3 Enterprise)*
- 2FA TOTP *(P1)*, WebAuthn/passkeys *(P2)*.
- Audit log (immutable, exportable, SIEM forward). *(P2 Pro)*
- Data catalog & lineage (which dashboards use which source/metric). *(P4)*
- Data retention, export & deletion tools (DPDP Act 2023 / GDPR readiness). *(P2)*
- Usage analytics for admins (which dashboards are used, slow queries). *(P3)*
- Compliance packs (P4): audit-ready reports for ISO 27001 / SOC 2 style controls.

### 7.11 Platform & Extensibility
- **Plugin system** (P2): connectors, panels, transforms, alert channels, AI providers, themes, auth providers. Sandboxed frontend plugins (iframe/Web Worker), signed plugins, permission manifest.
- **Plugin SDK + CLI** (`npx create-paarvix-plugin`) (P2), MIT licensed.
- **Marketplace** (P4): browse/install free & paid plugins/templates; revenue share.
- **Public REST + GraphQL API** with API keys, OAuth apps, rate limits, OpenAPI docs. *(P3)*
- **Embed SDK** `@paarvix/embed` (web component + Angular/React/Vue wrappers), signed short-lived JWT, theme overrides, per-token RLS, domain allow-list. *(P3 Enterprise)*
- **Webhooks** for events (dashboard updated, alert fired). *(P3)*
- **CLI** `paarvix` for backup, restore, import/export, license, migrations. *(P1)*
- **Terraform provider / IaC** for dashboards & data sources. *(P4)*

### 7.12 Multi-tenancy & Scale
- Org/workspace isolation; tenant ID enforced in every query; per-tenant encryption keys. *(P3)*
- Horizontal scaling: stateless API pods, Redis for sessions/cache/queues, worker pool for queries/reports/AI. *(P3)*
- Kubernetes Helm chart; HA PostgreSQL; zero-downtime upgrades. *(P4)*
- Edge/air-gapped install bundle with offline license and local AI. *(P4)*

### 7.13 Domain Template Packs
- **Education (P1 basic, P2 advanced):** results & grade distribution, subject analysis, toppers/failures, attendance & defaulters, fee collection & dues, placement stats, faculty workload, NAAC/NIRF metrics, admission funnel, library usage, exam timetable load.
- **Healthcare (P3):** OPD/IPD flow, bed occupancy, lab TAT, pharmacy stock, revenue.
- **Retail/SME (P3):** daily sales, top products, stock alerts, GST summary, customer repeat rate.
- **Manufacturing/IoT (P3):** OEE, machine status, downtime, energy.
- **Government/NGO (P4):** scheme coverage, district maps, beneficiary tracking.
- **DevOps (P3):** server, uptime, API latency.

### 7.14 Non-goals
- Being a full data warehouse or ETL suite.
- Log/trace storage at scale (connect to existing tools instead).
- Native mobile apps before PWA proves insufficient.
- Training our own foundation AI models.

---

## 8. Architecture

### 8.1 Stack

| Layer | Choice |
|---|---|
| Frontend | **Angular (latest)**, standalone components, **Signals**, zoneless where stable, OnPush, lazy routes, Nx monorepo |
| UI | Angular Material or PrimeNG (pick one) + design tokens (SCSS/CSS variables) |
| Charts | **Apache ECharts** (ngx-echarts) via adapter; **WebGL** (ECharts GL / deck.gl) for big data; Vega-Lite panel |
| Editor | Monaco (SQL/JSON/YAML) |
| Grid | angular-gridster2 |
| In-browser analytics | **DuckDB-WASM**, Web Workers, Apache Arrow |
| Backend | **NestJS** (TypeScript), modular monolith → extractable services |
| App DB | PostgreSQL (default), SQLite (lite/demo) |
| Analytics engine | DuckDB (server), source pushdown |
| Cache/queue | In-memory (lite) → Redis + BullMQ (scale) |
| Realtime | WebSocket/SSE gateway |
| AI | Provider adapter (OpenAI-compatible, Anthropic, Google, Ollama) |
| Search | PostgreSQL full-text (lite) → OpenSearch (scale) |
| Auth | Argon2id, JWT + httpOnly refresh, OIDC/SAML (passport strategies) |
| Observability | OpenTelemetry traces/metrics, Pino logs, `/metrics` Prometheus endpoint |
| Packaging | Docker (multi-arch amd64/arm64), compose, Helm |
| Testing | Vitest/Jest, Playwright e2e, k6 load tests, visual regression |
| CI/CD | GitHub Actions: lint, test, build, license check, secret scan, SBOM, image signing (cosign) |

### 8.2 System design

```
                ┌───────────── Angular SPA / PWA / Embed SDK ─────────────┐
                │  Builder · Viewer · AI Chat · Command Palette · Workers  │
                │  DuckDB-WASM (local files)  ·  ECharts/WebGL renderers   │
                └───────────────▲─────────────────────────▲───────────────┘
                        HTTPS/REST/GraphQL           WebSocket/SSE
                ┌───────────────┴─────────────────────────┴───────────────┐
                │                    NestJS API Gateway                    │
                │ Auth · RBAC/RLS · Tenancy · Rate limit · Audit · License │
                ├──────────┬───────────┬────────────┬───────────┬─────────┤
                │ Query    │ Semantic  │ AI         │ Alerting  │ Plugin  │
                │ Engine   │ Layer     │ Service    │ & Reports │ Host    │
                │ (DuckDB, │ (metrics) │ (providers,│ (BullMQ   │ (signed │
                │ pushdown,│           │ guardrails)│ workers)  │ plugins)│
                │ cache)   │           │            │           │         │
                └────┬─────┴─────┬─────┴─────┬──────┴─────┬─────┴────┬────┘
                     │           │           │            │          │
              Connectors   App DB (PG)   Redis/Queue   Object store  Realtime
            (SQL, files,                              (uploads,     streams
             APIs, streams)                            exports)   (MQTT/Kafka)
```

- **Modular monolith first** (one deployable, clean module boundaries). Extract query workers, AI and realtime into services only when load demands.
- **Lite mode** (default Community): API + SQLite/PG + in-memory cache, single container, < 512 MB RAM idle.
- **Scale mode:** API replicas + workers + Redis + PG HA + object storage.

### 8.3 Core contracts

```ts
interface Connector {
  id: string; capabilities: ConnectorCapabilities;
  testConnection(cfg): Promise<Result>;
  discoverSchema(cfg): Promise<Schema>;
  query(cfg, spec: QuerySpec, ctx: SecurityContext): Promise<ArrowTable | DataFrame>;
  stream?(cfg, sub: Subscription, ctx): AsyncIterable<DataFrame>;
}
interface PanelPlugin {
  id: string; optionsSchema: JSONSchema;
  render(el: HTMLElement, data: DataFrame, options, theme): PanelInstance;
}
interface Transform { id: string; apply(input: DataFrame, params): DataFrame; }
interface AlertChannel { id: string; send(alert: AlertEvent, cfg): Promise<void>; }
interface AIProvider { id: string; complete(req: AIRequest): Promise<AIResponse>; }
```
`SecurityContext` (user, tenant, roles, RLS predicates) is mandatory on every data path, including AI.

### 8.4 Monorepo (Nx) layout

```
paarvix/
├── apps/
│   ├── web/              Angular SPA/PWA
│   ├── api/              NestJS API
│   ├── worker/           queries, reports, alerts, AI jobs
│   ├── docs/             VitePress/Docusaurus site
│   └── demo/             static GitHub Pages build config
├── packages/
│   ├── shared/           types, DTOs, zod schemas
│   ├── query-engine/     QuerySpec, planner, DuckDB, cache
│   ├── semantic/         metrics layer
│   ├── connectors/*      one package per connector
│   ├── panels/*          one package per panel family
│   ├── transforms/
│   ├── ai/               provider adapters, prompt templates, guardrails
│   ├── alerting/
│   ├── plugin-sdk/       (MIT)
│   ├── embed/            (MIT client)
│   ├── cli/
│   └── ui/               design system components & tokens
├── templates/            domain packs (JSON/YAML)
├── deploy/               docker, compose, helm
├── e2e/  load-tests/
└── AGENTS.md, CLAUDE.md, LICENSE, COMMERCIAL-LICENSE.md, TRADEMARK.md, ...
```


---

## 9. Security (non-negotiable)

1. Secrets only in env/secret managers; `.env` git-ignored; `.env.example` with fake values; secret scanning + push protection in CI.
2. Argon2id passwords, 2FA/passkeys, account lockout, breached-password check (k-anonymity API, optional).
3. Short-lived access JWT; rotating refresh in httpOnly Secure SameSite cookie; CSRF tokens.
4. **Backend authorisation on every request** (guards + policy engine, e.g., CASL). RLS applied *before* caching and before AI.
5. Encrypted credentials (envelope encryption, key rotation); TLS everywhere; HSTS.
6. SQL safety: parameterised queries; read-only DB users recommended; SELECT/WITH allow-list via parser; timeouts; row/byte limits; per-user quotas.
7. OWASP ASVS L2 target: input validation (zod/class-validator), never bypass Angular sanitiser, strict CSP, Helmet headers, SSRF protection for REST/webhook connectors (block internal IPs unless allowed), upload validation & AV scan hook.
8. Plugin security: signed plugins, permission manifests, frontend sandboxing, no arbitrary server code from unsigned plugins.
9. AI security: prompt-injection defences (data treated as data, tool calls permission-checked), PII redaction, "no-egress" mode, audit of AI prompts/outputs.
10. Supply chain: lockfiles, Dependabot, `npm audit`, SBOM (CycloneDX), signed container images, reproducible builds.
11. Tenancy isolation tests in CI; per-tenant keys (Enterprise).
12. Privacy: DPDP Act 2023 alignment — consent, minimal data, export/delete, retention policies; student/patient data treated as sensitive by default.
13. Disclosure via `SECURITY.md`; security advisories on GitHub.
14. Telemetry: **opt-in only**, anonymous, documented, easy to disable.

### 9.1 License system
- Ed25519-signed license JSON `{ id, customer, edition, features[], limits{users,tenants,aiCredits}, instanceId?, issuedAt, expiresAt }`.
- Public key in app; private key offline. Online + **offline activation**.
- Expiry → warning + grace period; **never lock users out of their data**; Pro features degrade gracefully.
- Invalid/tampered → Community mode.

---

## 10. Performance Budgets

| Metric | Target |
|---|---|
| Community idle RAM | < 512 MB (lite mode) |
| Initial JS (gzipped) | < 400 KB; rest lazy-loaded |
| First dashboard render (12 panels, cached) | < 1.5 s |
| Panel interaction (filter/cross-filter) | < 200 ms |
| Table | 100k rows smooth via virtual scroll |
| Charts | 1M points via WebGL/downsampling (LTTB) |
| Upload | 50 MB Excel analysed in browser via DuckDB-WASM |
| API p95 (cached) | < 100 ms |
| Concurrent viewers (scale mode, 4 vCPU) | 1,000+ |

Techniques: Web Workers, Arrow columnar transfer, LTTB downsampling, query result cache, CDN for static assets, HTTP compression (brotli), virtual scrolling, `@defer` blocks in Angular.

---

## 11. UX & Design System

- Design tokens (colour, spacing 4/8, radius, elevation, motion), light/dark/high-contrast themes, per-tenant theming.
- Mobile-first viewer; desktop-optimised builder; TV mode.
- Indian formats (DD-MM-YYYY, ₹, lakh/crore), RTL-ready i18n; English + Tamil first, then Hindi, Malayalam, Telugu, Kannada.
- Chart guidelines: titles with units, direct labels, no 3D by default, colour-blind-safe palettes, accessible data table alternative.
- Micro-interactions: skeleton loaders, optimistic UI, toast feedback, undo.
- Every empty state → template, upload, or "Ask AI".

---

## 12. Engineering Standards

- TypeScript strict; no unexplained `any`.
- Angular: standalone, Signals, OnPush, `@defer`, typed forms, smart/presentational split, no logic in templates, Storybook for UI package.
- NestJS: domain modules, DTO validation, thin controllers, services/repositories, CQRS where useful, OpenAPI decorators.
- Conventional Commits, signed commits, small PRs, ADRs (`docs/adr/`) for architectural decisions.
- Tests: unit ≥ 80% on core packages, e2e for every user flow, contract tests for connectors, tenancy isolation tests, load tests before releases, visual regression for panels.
- Docs-as-code: every feature ships with docs + CHANGELOG + i18n strings.
- AGPL header on every new public file; MIT header on SDK packages.
- Semantic versioning; LTS release every 6 months; migration guides.

---

## 13. Roadmap

| Phase | Timeline (solo, part-time realistic) | Outcome |
|---|---|---|
| **P0 Foundation** | Weeks 1–3 | Nx monorepo, legal files, CI (lint/test/license/secret scan), Docker lite mode, auth + setup wizard, design system base, AGENTS.md |
| **P1 MVP Community** | Weeks 4–12 | Core connectors (CSV/Excel/Sheets/MySQL/PG/SQLite/REST), query builder, SQL editor, 11 panels, dashboards + filters, College Pack basic, sharing/export, email alerts, en/ta, CLI backup, GitHub Pages demo |
| **P2 Launch** | Months 3–6 | Public launch (HN, r/selfhosted, Product Hunt), DuckDB-WASM, transforms, more panels & connectors, plugin SDK, AI ask-in-English/Tamil (BYO/local), Pro: reports, WhatsApp alerts, RBAC/RLS, audit, white-label, license system |
| **P3 Cloud & Intelligence** | Months 6–12 | Multi-tenant Paarvix Cloud (funded by clients), semantic layer, AI insights/anomaly/forecast, real-time streaming, embed SDK, public API, SSO, healthcare/retail/IoT packs, partner program |
| **P4 Ecosystem** | Year 2 | Marketplace, MCP server for AI agents, collaboration (co-editing), workflow automation, Helm/HA, air-gapped bundle, governance/lineage |
| **P5 Global** | Year 3+ | 20+ languages, certification program, enterprise compliance, regional cloud, community conferences |

---

## 16. Agent Operating Rules

1. Read this file first; obey phase order — **do not build P3/P4 features before P1 is done** unless the founder asks.
2. Design for extension: new capabilities go through the plugin/contract interfaces in §8.3.
3. Ask before: new dependency, license change, architecture change, paid service, anything possibly Pro in the public repo.
4. Never commit secrets, keys, real customer/student data, or `.env`. Check `git status` before every commit.
5. Never copy code, UI, icons, text or names from Grafana, Metabase, Power BI, Tableau or any incompatible source.
6. Community must work fully without Pro packages and within the lite-mode budget.
7. `SecurityContext` on every data path; RLS before cache and before AI.
8. Prefer simple, readable code — one person maintains this.
9. Every change: tests, docs, CHANGELOG, i18n, license header.
10. Explain trade-offs and assumptions in PRs; write an ADR for big decisions.
11. When unsure: choose **simpler, safer, keeps free core free** — and say so.

### Definition of Done
- [ ] Works in lite Docker mode and dev mode
- [ ] Backend authZ + RLS enforced; inputs validated
- [ ] Unit + e2e (+ contract/tenancy where relevant) pass in CI
- [ ] Performance budget respected
- [ ] i18n (en + ta) strings; accessible; mobile viewer checked
- [ ] Docs, CHANGELOG, ADR (if architectural) updated
- [ ] License headers; dependency licenses OK; no secrets in diff

---

## 17. Glossary

- **Panel** — one visual block. **Dashboard** — grid of panels with shared filters.
- **Connector** — plugin that talks to a data source. **QuerySpec** — engine-neutral query description.
- **Transform** — data-reshaping step. **Semantic layer** — reusable business metric definitions.
- **RLS/CLS** — row/column-level security. **SecurityContext** — user + tenant + permissions passed to every data operation.
- **Lite mode / Scale mode** — single-container small install / distributed deployment.
- **Community / Pro / Enterprise** — free AGPL / paid modules / large-org features.
- **Open core / Dual licensing** — free core + paid extensions / AGPL or commercial license for the same code.
- **MCP** — Model Context Protocol; lets external AI agents use Paarvix safely.

---

*Paarvix — See your data clearly. © 2026 KannanTech. Built in India, for the world.*
