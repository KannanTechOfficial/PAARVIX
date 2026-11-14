# Changelog

All notable changes to Paarvix will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Queries page: build a query step by step (columns, filters, summarise, sort, limit) or write SQL in the Monaco editor with table and column suggestions. Results show as a table with Indian number grouping and DD-MM-YYYY dates, or as a bar, line or pie chart, and download as CSV.
- Saved queries, private by default and shareable with everyone who can use the source, and a private list of each person's last 50 runs.
- Super Admin panel: users, roles with a role editor, per-source data access, plugins, organisation settings and a theme. The menu shows only what each person may open.
- Google sign-in for people an administrator has added.
- Dashboards: drag-and-drop panels from saved queries (number, bar, line, pie, table, text), chosen roles per dashboard, and previews as any role or person. Viewers never send queries; the server runs each panel's saved query.
- New dashboard viewer, composed for each device instead of one grid of boxes. Panels have a role (headline, main chart, supporting chart, detail table, note) and sit in sections. Laptop: frameless headline numbers with change and trend line, sticky section navigation. Phone: an app with a top bar, two-column headlines, bottom section tabs, swipe between sections, pull to refresh, tables in a bottom sheet. TV: `/tv/<id>`, dark, large type, one section per screen on rotation, clock, stale-data warning, screen kept awake.
- New look across the app. Light: quiet neutral sidebar with the Paarvix mark, soft rounded surfaces and shadows, a segmented section control. Dark: near-black with lifted surfaces and a brighter brand blue. Headline numbers sit on tiles, and their change is green or red by meaning: each headline says whether a rise is good or bad news. The theme follows the device until someone chooses. New split-screen sign-in page.
- Brand fonts (Inter, Poppins, JetBrains Mono) are bundled and served by Paarvix itself, so they also work offline. Fonts are licensed OFL-1.1, now allowed for font files only.
- Dashboards feel native: headline numbers count up on first load, panels arrive in a short cascade, buttons respond to presses, a phone's large title collapses into the top bar, the detail sheet can be dragged down to close, and Android phones give a light tap on tab changes. All motion is off when the device asks for reduced motion.
- Paarvix can be installed as an app (manifest, icons, service worker that never caches API data). Panel results are kept on the device for weak connections and deleted at sign-out.
- Dashboards saved in the old format are upgraded automatically on load and on the next save.
- Home dashboard per role or person, with an option to show only that dashboard and no menu.
- Row rules: each person sees only their own rows (for example a student's own record, or an HOD's own department), enforced on the server for every dashboard, query and preview.
- `./dev.sh` runs Paarvix on a laptop with live reload, using only Paarvix's own database container.

### Editions

- Paarvix now has three editions: Community (free for ever), Pro and Enterprise (see `docs/editions.md`, ADR 0003). Custom roles, per-source access, theme and row rules stay in Community.
- New *Licence* page in Administration: shows the edition this server runs and what each edition includes, and lets a Super Admin paste a licence key. Keys are checked on the server with no internet; `PAARVIX_LICENSE` and `PAARVIX_LICENSE_FILE` also work. An expired licence keeps paid features for 30 days; Community features and data are never locked.
- Extension points for optional modules, and a CI check that keeps Community features free and paid code out of this repository.

### Fixed

- CI secret scan: a made-up 12-digit register number in help text looked like an Aadhaar number. The example is now `23CS001`.

- Sign out now really signs out. Before, the login page could open before the server had deleted the session cookie, and signed the person straight back in.
- After Google sign-in, people land on their home dashboard. The Sign in button no longer stays on "Loading" if the next page cannot open.

### Security

- Sessions are kept on the server (ADR 0002). Signing out ends the session itself, so a copied cookie or token stops working at once. Each renewal uses a one-time token; an old one replayed ends the session. A password reset or deactivation signs the person out everywhere immediately, not after 15 minutes. Sessions end after 7 days unused and 30 days at most (`JWT_REFRESH_EXPIRY`, `SESSION_MAX_AGE`). Everyone signs in once more after this update.
- New *Your account* page (click your name in the menu) lists signed-in devices, and lets you sign out any one of them or all the others. Administrators can *Sign out everywhere* for a person from Users, for example after a lost phone.
- Every API route now names the permission it needs; a route without one is refused.
- SQL is parsed before it runs (PostgreSQL, MySQL, MariaDB). Only one read-only SELECT is accepted, and text that cannot be parsed is refused.
- Sessions renew silently from an httpOnly cookie; the access token is no longer kept in browser storage.
- Five wrong passwords for one account from one address pause sign-in there for 15 minutes. Sign-in no longer reveals which emails have accounts.
- Resetting a password or deactivating a user ends their open sessions.
- The Docker API port now listens on the local machine only.

- The API refuses to start with a missing, short or default signing secret. Docker now uses the secrets the installer creates, instead of fixed values.
- The Docker database port is now reachable only from the same machine.

### Changed

- Paarvix now starts empty: dashboards appear only after an admin applies a template, and can be removed from Templates.
- College data routes now require login and an applied template.
- All data now comes from connected data sources: bundled college data and the simulated infrastructure dashboard are removed.
- Login page no longer shows or pre-fills admin credentials.
- Data source passwords are encrypted and never returned by the API.

### Added

- Connect Excel files, Google Sheets and MySQL or MariaDB databases. Spreadsheets are imported into Paarvix, and databases are read live.
- A preview of each source's tables, columns and first rows.
- Indian number and date formats are understood during import, and codes, phone numbers and long IDs stay exact.
- User guides in `docs/guide/`, and a roadmap in `docs/roadmap.md`.
- CI secret scan across full history, and a license check that can fail the build. `elkjs@0.11.1` (EPL-2.0) is an exact-version exception, because it arrives only through Prisma Studio.
- CI scan rules for Aadhaar numbers, Indian mobile numbers and passwords written in code.
- PostgreSQL connection testing and read-only queries.
- Data Sources page. See `docs/college-data-source.md`.

### Added
- Initial monorepo scaffold (P0 Foundation)
- Root workspace with npm workspaces
- NestJS + Fastify API skeleton (`apps/api`)
- Angular SPA skeleton (`apps/web`)
- Shared types package (`packages/shared`)
- Docker Compose setup (PostgreSQL + API + Web)
- GitHub Actions CI (lint, test, build, license check)
- Legal files (LICENSE, CONTRIBUTING, SECURITY, etc.)
- AGPL v3.0 licensing
