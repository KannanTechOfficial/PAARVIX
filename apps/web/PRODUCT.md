# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Paarvix serves people at different depths inside one institution. The first institutions are colleges and schools.

- **HOD or manager.** On a desktop, weekly. Uploads a spreadsheet, filters, asks questions. Not technical.
- **Principal or owner.** On a phone. Glances at a summary and receives alerts. Never builds anything.
- **Data analyst.** Writes SQL and builds dashboards on a large screen.
- **IT admin.** Installs, connects databases, manages users and settings.
- **Student or staff member.** Sees only their own record.

When their needs conflict, the HOD or manager wins (founder decision, 2026-11-14).

## Product Purpose

Paarvix is an open-source platform for dashboards, analytics and alerts that an institution runs on its own server. A person uploads a spreadsheet or connects a database and gets a useful dashboard within two minutes, then goes deeper when ready.

Success: a non-technical HOD uploads a real-format sheet and gets a useful dashboard in under two minutes, unaided, on a server with 2 GB of RAM.

## Positioning

An open-source alternative to Grafana for dashboards and alerting, built for people who are not engineers.

- Starts from spreadsheets and ready-made templates, not from a blank canvas.
- Tamil and English from the first release, with Indian number and date formats by default.
- A viewer cannot reach data outside the dashboards they are allowed to see.
- The whole viewing side can be redesigned by the institution without touching the core.

Paarvix does not compete on logs, traces, profiling or very large monitoring setups.

## Operating Context

- Self-hosted, often on a small server on a campus network, sometimes with no internet access.
- Data arrives as Excel files, Google Sheets, MySQL and PostgreSQL databases.
- Used on office desktops, on inexpensive phones, and on wall-mounted screens.
- A new install is empty. An admin applies a template and chooses a data source. No sample or mock data is shown anywhere.
- Student records are sensitive personal data.

## Capabilities and Constraints

**One app, two shells.** The existing `apps/web` holds both.

- **Workspace (client).** Where people view and build dashboards. Fully themeable.
- **Administration.** Users, roles, data sources, settings. Always in the default design, so a broken theme cannot lock an admin out.

Which sections a person sees follows their permissions.

**Roles.** A fixed Super Admin, plus built-in Admin, Editor, Analyst and Viewer. Permissions are written as `resource:verb`. The founder wants roles that a Super Admin can create and edit. **Open decision:** whether the role editor ships in Community or Pro.

**Theming.** Five override layers on top of the default design: tokens, layout, page templates, custom CSS, and custom components. Layers one to four are data only and contain no scripts. Full design in `docs/research/grafana/12-gaps-and-opportunities.md`. **Open decision:** edition and phase for each layer.

**Built today:** login, first-run setup, data sources (Excel, Google Sheets, MySQL, PostgreSQL) with preview, templates, two college dashboards.

**Not built yet:** dashboard builder, query page, user management, permission-driven navigation, theming layers, alerts.

**Constraints:**

- Angular with standalone components and Signals. NestJS API.
- Initial JavaScript under 400 KB gzipped. Panel interactions under 200 ms.
- Community edition runs fully on 2 GB RAM and one vCPU.
- Every UI string exists in English and Tamil.
- No code, interface, icons, text or names copied from Grafana, Metabase, Power BI or Tableau.

## Brand Commitments

- **Name:** Paarvix ("PAAR-vix"), from the Tamil *paarvai* (பார்வை, vision).
- **Tagline:** See your data clearly.
- **Voice:** clear, confident, helpful. No jargon for end users.
- **Company:** KannanTech.
- **Binding palette** (founder decision, 2026-11-14): deep blue `#1E3A8A`, teal `#14B8A6`, orange `#F97316`, slate neutrals, full dark theme.
- **Binding fonts** (founder decision, 2026-11-14): Inter for the interface, JetBrains Mono for code and SQL, Poppins for marketing.
- **Design system:** the current components are to be rebuilt on these, not documented as they are (founder decision, 2026-11-14).

## Evidence on Hand

- Research on Grafana 13 in `docs/research/grafana/`, twelve documents.
- User guides in `docs/guide/`, and a roadmap in `docs/roadmap.md`.
- Social preview banner and screenshots in `docs/assets/`.
- No customers, testimonials, case studies, benchmarks or usage figures exist. Future work must not invent any.

## Product Principles

1. **Progressive power.** Simple by default, advanced on request. A principal and an analyst use the same product at different depths.
2. **Templates before a blank canvas.** Nobody starts from an empty screen.
3. **Own your data.** Self-hosting and offline use are first-class.
4. **Secure by default.** Hiding a dashboard hides its data.
5. **The free core stays free.** A feature never moves from free to paid.

## Accessibility & Inclusion

- WCAG 2.2 AA.
- Every chart has a data table that a screen reader can use.
- Colour-blind-safe chart palettes.
- English and Tamil first, then Hindi, Malayalam, Telugu and Kannada. Layout stays ready for right-to-left languages.
- Indian formats by default: DD-MM-YYYY, ₹, lakh and crore.
- Must work on a low-cost phone.
