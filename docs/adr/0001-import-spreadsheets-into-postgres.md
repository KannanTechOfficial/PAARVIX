# ADR 0001: Import Spreadsheets into PostgreSQL

Status: accepted. Date: 2026-11-01.

## Context

Excel files and Google Sheets are the most common data sources for our users, but they are not query engines. Paarvix must filter and group them quickly within the 2 GB Community budget.

## Decision

Import spreadsheet data into generated tables in a dedicated `paarvix_data` schema in the application database. Query them only through `QuerySpec`.

MySQL and PostgreSQL sources stay live.

Generated tables and columns use names such as `t_<cuid>` and `c0`, never user text. Original names live in the `data_tables` row. This also avoids PostgreSQL's 63-byte identifier limit.

## Alternatives rejected

- **Server DuckDB now:** the most capable option, and the brief's P2 direction. It adds a native binary for two architectures and more memory pressure in lite mode, before it is needed. `QuerySpec` lets it be added later without changing dashboards.
- **Parsing the file on each query:** little code, but far too slow and memory-heavy for dashboards.

## Consequences

- Spreadsheet data is a snapshot, so sources show a last-synced time.
- **No raw SQL on spreadsheet sources.** Imported tables share a database with `users`, so an SQL path could reach them. `compileQuery` accepts only names found in the source's own schema, which confines a query to its own tables.
- `paarvix_data` relies on Prisma managing only `public`. This is checked by restarting with imported data present.
- Database size grows with imported data.
