# Changelog

All notable changes to Paarvix will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

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
