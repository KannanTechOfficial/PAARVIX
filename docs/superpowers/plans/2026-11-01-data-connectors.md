# Stage 1 Data Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin can connect an Excel file, a Google Sheet or a MySQL database, see its tables, and query them through one safe path, with plain-language guides for every kind of organisation.

**Architecture:** A `Connector` interface and registry replace Postgres-only code in `DatasourcesService`. Engine-neutral `QuerySpec` objects compile to parameterised SQL. Excel and Sheets data is imported into generated tables in the `paarvix_data` schema, and MySQL and Postgres are queried live.

**Tech Stack:** NestJS 12 + Fastify, Prisma 7, `pg`, `mysql2`, `exceljs`, Angular 22 with `@ngx-translate`, Jest.

**Spec:** `docs/superpowers/specs/2026-11-01-data-connectors-design.md`

**Branch:** `feat/data-connectors`, created from `main` before Task 1. The spec and this plan are the first commit.

## Global Constraints

- Paarvix is read-only: every connector has `supportsWrite: false`.
- Raw SQL is never allowed on `excel` or `gsheet` sources.
- Query limits: 30 seconds, 10,000 rows, results over the limit marked `truncated`.
- `SecurityContext` is required on every data path, and `rowFilters` are always applied.
- Upload limits: `.xlsx` only, 50 MB, 50 sheets, 500 columns, 1,000,000 rows per sheet.
- Sheet sync interval: 15 minutes or more, default off.
- No sector words (student, invoice, patient) in connector, query or API code.
- Only new dependencies: `exceljs` and `mysql2`. No Google library.
- Secrets use `encryptSecret`, and are never returned or logged. No row data in logs or errors.
- AGPL header on every new `.ts` file. No real student or company data in tests or fixtures.
- Automated tests only for `compileQuery`, read-only enforcement and import parsing. Everything else is checked by compile and start.
- New UI strings go in both `apps/web/public/assets/i18n/en.json` and `ta.json`.

## Review Focus

1. A spreadsheet with blank rows or merged cells above the data: the first non-empty row is the header, and a merged header does not shift columns. Tested in Task 4. A title row above the headers is a known stage 1 limit, covered in the guide.
2. Identifier-like numbers such as `00123`, phone numbers and 16-digit IDs: they stay text, never lose leading zeros or precision. Tested in Task 4.
3. Long, Tamil or punctuated column headers: they work and keep their exact names, despite PostgreSQL's 63-byte identifier limit. Tested in Tasks 1 and 4.
4. A re-upload that removes a column a saved query uses: the query fails with "column no longer exists", not a server error. Tested in Task 1.
5. A file with only headers, or a sheet that is empty: empty sheets are skipped, a header-only sheet imports with 0 rows, and a file with nothing readable gives "This file has no data". Tested in Task 4.

---

### Task 1: QuerySpec types and compiler

**Files:**
- Create: `packages/shared/src/query.ts`
- Modify: `packages/shared/src/index.ts`, `apps/api/package.json` (add `"@paarvix/shared": "*"` if absent)
- Create: `apps/api/src/datasources/query-compiler.ts`
- Test: `apps/api/src/datasources/query-compiler.spec.ts`

**Interfaces:**
- Produces in `@paarvix/shared`: `SecurityContext`, `QuerySpec`, `Filter`, `FilterOp`, `ColumnType = 'number' | 'date' | 'boolean' | 'text'`, `ColumnSchema { name: string; type: ColumnType; storageName?: string }`, `TableSchema { name: string; columns: ColumnSchema[]; storageName?: string; rowCount?: number }`, `QueryResult { fields: string[]; rows: Record<string, unknown>[]; truncated: boolean }`. Shapes for the first three are in the spec.
- Produces in `query-compiler.ts`: `compileQuery(spec: QuerySpec, table: TableSchema, dialect: 'postgres' | 'mysql', ctx: SecurityContext): { text: string; values: unknown[]; labels: string[] }` and `labelRows(rows, labels): Record<string, unknown>[]`.

- [ ] **Step 1: Write failing tests** with a fixture table `sales` (`Amount` number, `Region` text) and an empty-filter `ctx`:

```ts
it('binds values and quotes names for each dialect', () => {
  const spec = { table: 'sales', filters: [{ column: 'Region', op: 'eq', value: 'South' }] };
  expect(compileQuery(spec, sales, 'postgres', ctx).text).toContain('"Region" = $1');
  expect(compileQuery(spec, sales, 'mysql', ctx).text).toContain('`Region` = ?');
  expect(compileQuery(spec, sales, 'postgres', ctx).values[0]).toBe('South');
});
it('rejects unknown names', () => {
  expect(() => compileQuery({ table: 'sales', columns: ['x"; DROP TABLE users;--'] }, sales, 'postgres', ctx))
    .toThrow('column no longer exists');
});
it('never places a value in the SQL text', () => {
  const r = compileQuery({ table: 'sales', filters: [{ column: 'Region', op: 'contains', value: "' OR 1=1 --" }] }, sales, 'postgres', ctx);
  expect(r.text).not.toContain('OR 1=1');
});
it('always applies rowFilters', () => {
  const r = compileQuery({ table: 'sales' }, sales, 'postgres',
    { ...ctx, rowFilters: [{ column: 'Region', op: 'eq', value: 'South' }] });
  expect(r.text).toContain('WHERE');
  expect(r.values).toContain('South');
});
it('caps limit at 10,000 and fetches one extra row', () => {
  expect(compileQuery({ table: 'sales', limit: 999999 }, sales, 'postgres', ctx).text).toContain('LIMIT 10001');
});
it('uses storage names and returns original labels', () => {
  const long = 'மொத்த விற்பனை '.repeat(10);
  const t = { name: 'sales', storageName: 'paarvix_data.t_abc', columns: [{ name: long, type: 'number', storageName: 'c0' }] };
  const r = compileQuery({ table: 'sales' }, t, 'postgres', ctx);
  expect(r.text).toContain('"paarvix_data"."t_abc"');
  expect(r.labels).toEqual([long]);
});
```

- [ ] **Step 2: Run** `npx jest query-compiler` in `apps/api`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `compileQuery`.** Every output column uses a generated alias (`f0`, `f1`), and `labels[i]` holds its display name. `labelRows` restores names. Aggregates without a `column` allow only `count`. `sum` and `avg` require a `number` column. `contains` escapes `%`, `_` and `\` in the value and uses `ILIKE` on Postgres and `LIKE` on MySQL. A dotted `storageName` is quoted per part. Unknown table or column throws `BadRequestException('column no longer exists: <name>')`, truncating the name to 64 characters.

- [ ] **Step 4: Run tests.** Expected: PASS.

- [ ] **Step 5: Commit** with `feat(query): add QuerySpec compiler`.

### Task 2: Connector contract and Postgres migration

**Files:**
- Create: `apps/api/src/datasources/connectors/connector.ts`, `postgres.connector.ts`, `connector-registry.ts`
- Create: `apps/api/src/datasources/sql-guard.ts`, `apps/api/src/datasources/security-context.ts`
- Delete: `apps/api/src/datasources/postgres.connector.ts`
- Modify: `datasources.service.ts`, `datasources.controller.ts`, `datasources.module.ts`, `apps/api/src/college/college.service.ts`
- Test: `apps/api/src/datasources/sql-guard.spec.ts`

**Interfaces:**
- Consumes: Task 1 types and `compileQuery`.
- Produces: `Connector` and `LoadedDatasource { id; type; config: Record<string, unknown> }` per the spec, with `config` decrypted. `ConnectorRegistry.get(type: string): Connector`, which throws `BadRequestException` when unknown. `assertReadOnlySql(sql): string`. `toSecurityContext(user: { id: string; role: string }): SecurityContext` with `tenantId: null, rowFilters: []`. `DatasourcesService.schema(id, ctx)`, `.data(id, spec, ctx)`, `.query(id, sql, values, ctx)`.

- [ ] **Step 1: Write failing tests** for `assertReadOnlySql`: accepts `SELECT 1`, `with a as (select 1) select * from a` and a trailing `;`. Rejects `DELETE FROM x`, `SELECT 1; DROP TABLE x`, and empty input.

- [ ] **Step 2: Run** `npx jest sql-guard`. Expected: FAIL.

- [ ] **Step 3: Move** `assertReadOnlySql` unchanged into `sql-guard.ts`, and the Postgres code into `connectors/postgres.connector.ts`, implementing `Connector` with `supportsRawSql: true`.

- [ ] **Step 4: Add `discoverSchema`** reading `information_schema.columns`, excluding `pg_catalog` and `information_schema`. Map data types to `ColumnType`, defaulting to `text`. `query` loads the schema, finds the table, calls `compileQuery`, and runs it through the same read-only transaction path as `runSql`.

- [ ] **Step 5: Refactor `DatasourcesService`.** Remove the `postgres` checks. Secret decryption handles any `encrypted*` key in `config`, and `publicView` strips them all and adds `hasPassword`. `CollegeService` methods build a context with `toSecurityContext`; add `id` to `CollegeUser`.

- [ ] **Step 6: Add routes** `GET /datasources/:id/schema` and `POST /datasources/:id/data` (Admin, Editor). All data routes pass `toSecurityContext(user)`.

- [ ] **Step 7: Verify.** `npx jest` passes and `npm run build:api` succeeds. Start the API and confirm the existing Postgres test route still responds.

- [ ] **Step 8: Commit** with `refactor(datasources): add connector contract and move Postgres behind it`.

### Task 3: MySQL connector

**Files:**
- Create: `apps/api/src/datasources/connectors/mysql.connector.ts`
- Modify: `connector-registry.ts`, `datasources.service.ts`, `apps/api/package.json`, `THIRD_PARTY_LICENSES.md`

**Interfaces:**
- Consumes: `Connector`, `compileQuery`, `assertReadOnlySql`.
- Produces: registered type `mysql`. Config `{ host; port?: number (default 3306); database; user; encryptedPassword?; ssl?: boolean }`.

- [ ] **Step 1: Install** `mysql2` in `apps/api`.

- [ ] **Step 2: Implement `mysqlConnector`.** Create one connection per call with `multipleStatements: false`, `dateStrings: true`, `decimalNumbers: true`, `connectTimeout: 10000`, always closed in `finally`. With `ssl`, set `{ rejectUnauthorized: true }`. `runSql` and `query` share one path:
  1. Read `SELECT VERSION()`.
  2. Set `max_statement_time = 30` on MariaDB, or `max_execution_time = 30000` on MySQL.
  3. `START TRANSACTION READ ONLY`.
  4. Run the statement. Raw SQL is wrapped as `SELECT * FROM (<sql>) AS paarvix_q LIMIT 10001`.
  5. `ROLLBACK`.

- [ ] **Step 3: Implement `discoverSchema`** from `information_schema.columns` filtered to `table_schema = cfg.database`, with the same type mapping as Postgres.

- [ ] **Step 4: Validate on create.** `DatasourcesService.create` asks the connector to validate config, so required host, database and user apply to `mysql` as well as `postgres`, and the password is stored with `encryptSecret`.

- [ ] **Step 5: Verify** against a disposable local container: `docker run --rm -e MYSQL_ROOT_PASSWORD=dev -e MYSQL_DATABASE=demo -p 3307:3306 mysql:8`. Confirm test, schema, `QuerySpec` and raw SQL work, `DELETE` is refused, and `SELECT SLEEP(40)` stops at 30 seconds.

- [ ] **Step 6: Commit** with `feat(connectors): add MySQL and MariaDB`.

### Task 4: Import pipeline

**Files:**
- Create: `apps/api/src/datasources/import/infer.ts`, `workbook.ts`, `table-store.ts`
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/package.json`, `THIRD_PARTY_LICENSES.md`
- Test: `apps/api/src/datasources/import/infer.spec.ts`, `workbook.spec.ts` (builds workbooks in a temp directory with `exceljs`)

**Interfaces:**
- Produces: `ColumnTracker` with `add(value: unknown): void`, `type(): ColumnType`, plus `normalise(value: unknown, type: ColumnType): string | number | boolean | Date | null`.
- `readWorkbook(path: string): AsyncIterable<SheetRows>` where `SheetRows { name: string; rows: AsyncIterable<unknown[]> }`, and `readHeader(rows): Promise<string[]>`.
- `TableStore.replaceAll(datasourceId: string, path: string): Promise<TableSchema[]>`, `.tables(datasourceId): Promise<TableSchema[]>`, `.run(table: TableSchema, compiled, ...): Promise<QueryResult>`, `.dropAll(datasourceId): Promise<void>`.

- [ ] **Step 1: Write failing inference tests:**

```ts
it.each([
  [['1,25,000', '₹2,500.50', 300], 'number'],
  [['15-08-2026', '01/02/2026'], 'date'],
  [['true', 'FALSE'], 'boolean'],
  [['00123', '00456'], 'text'],
  [['9876543210', '9123456780'], 'text'],
  [['1234567890123456', '1234567890123457'], 'text'],
  [['12', 'pending'], 'text'],
  [[null, '', 5], 'number'],
])('%j infers %s', (values, expected) => { /* add each, expect type() */ });
it('reads DD-MM-YYYY as day first', () => {
  expect(normalise('01-02-2026', 'date')).toEqual(new Date(Date.UTC(2026, 1, 1)));
});
it('parses Indian grouping', () => expect(normalise('₹1,25,000', 'number')).toBe(125000));
```

- [ ] **Step 2: Write failing workbook tests:** blank rows above the data are skipped and the first non-empty row is the header. A title row is therefore taken as the header in stage 1, so the preview must show this and `connecting-data.md` must tell users to remove title rows. A merged header `A1:B1` keeps later columns aligned. Blank headers become `column_1`. Duplicate headers become `Name`, `Name_2`. Formula cells yield their stored result. An empty sheet is skipped. A header-only sheet yields 0 rows. A file with no readable sheet throws "This file has no data". A renamed text file throws "Please upload an .xlsx file".

- [ ] **Step 3: Run** `npx jest import`. Expected: FAIL.

- [ ] **Step 4: Implement `infer.ts`.** Rules: empty values are ignored. A string with a leading zero followed by digits, or 10 or more digits with no separators, is text. An Excel numeric cell of 10 or more digits is also text. An all-empty column is `text`.

- [ ] **Step 5: Implement `workbook.ts`** with `ExcelJS.stream.xlsx.WorkbookReader`, reading cached formula results and ignoring macros. Check the `PK\x03\x04` signature first. Enforce 50 sheets, 500 columns and 1,000,000 rows, each with a plain message.

- [ ] **Step 6: Add the `DataTable` model** from the spec, plus `dataTables DataTable[]` on `Datasource`. Add `lastSyncError` as a key in `Datasource.config`, with no column.

- [ ] **Step 7: Implement `TableStore`.** It runs `CREATE SCHEMA IF NOT EXISTS paarvix_data` on module init. `replaceAll` makes two passes over the temp file:
  1. Infer types with `ColumnTracker`.
  2. Create `t_<cuid>` with columns `c0..cn` (`numeric`, `timestamptz`, `boolean`, `text`) and insert batches of `min(1000, floor(60000 / columns))` rows.

  Then one transaction replaces `DataTable` rows and drops old tables. If loading fails, the new tables are dropped and the old data stays. `run` executes inside a transaction with `SET LOCAL transaction_read_only = on` and `SET LOCAL statement_timeout = 30000`, then converts `Decimal` and `bigint` to numbers when safe, otherwise to strings.

- [ ] **Step 8: Run tests and build.** Expected: PASS.

- [ ] **Step 9: Commit** with `feat(import): add spreadsheet import pipeline`.

### Task 5: Excel connector and upload routes

**Files:**
- Create: `apps/api/src/datasources/connectors/imported.connector.ts`
- Modify: `connector-registry.ts`, `datasources.service.ts`, `datasources.controller.ts`, `datasources.module.ts`

**Interfaces:**
- Consumes: `TableStore`, `compileQuery`.
- Produces: registered types `excel` and `gsheet` sharing `importedConnector`, with `supportsRawSql: false` and no `runSql`. `DatasourcesService.createFromUpload(name, file, userId)` and `.replaceUpload(id, file)`.

- [ ] **Step 1: Implement `importedConnector`.** `testConnection` passes if tables exist. `discoverSchema` returns `TableStore.tables`. `query` compiles for `postgres` and calls `TableStore.run`.

- [ ] **Step 2: Add routes** `POST /datasources/upload` and `POST /datasources/:id/upload` (Admin). Stream the multipart file to a `mkdtemp` directory, name it with a generated filename, and delete it in `finally`. If `file.truncated` is true, respond "File is larger than 50 MB".

- [ ] **Step 3: Refuse raw SQL.** `POST /datasources/:id/query` returns 400 "SQL is not available for spreadsheet sources" when the connector has no `runSql`.

- [ ] **Step 4: Clean up.** `remove(id)` calls `TableStore.dropAll` before deleting the row.

- [ ] **Step 5: Verify manually** with a generated `.xlsx`: upload, schema, query, re-upload, raw SQL refused, delete drops tables. Restart the API through the normal `prisma db push --accept-data-loss` start and confirm imported tables survive.

- [ ] **Step 6: Commit** with `feat(connectors): add Excel uploads`.

### Task 6: Google Sheets

**Files:**
- Create: `apps/api/src/datasources/connectors/gsheet.client.ts`, `apps/api/src/datasources/sheet-sync.service.ts`
- Modify: `datasources.service.ts`, `datasources.controller.ts`, `datasources.module.ts`
- Test: `apps/api/src/datasources/connectors/gsheet.client.spec.ts`

**Interfaces:**
- Consumes: `TableStore.replaceAll`.
- Produces: `parseSheetId(link: string): string`, `downloadSheet(id, serviceAccount | undefined, destPath): Promise<void>`, `SheetSyncService.sync(id): Promise<void>`. Config `{ spreadsheetId; encryptedServiceAccount?; syncMinutes?: number; lastSyncAt?; lastSyncError? }`.

- [ ] **Step 1: Write failing tests** for `parseSheetId`: extracts the ID from a normal `/spreadsheets/d/<id>/edit#gid=0` link, and rejects `http://169.254.169.254/x`, a non-Google host, and an ID with `/` or `..`.

- [ ] **Step 2: Run** `npx jest gsheet`. Expected: FAIL.

- [ ] **Step 3: Implement `gsheet.client.ts`.** Public export URL: `https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx`. Private: sign an RS256 JWT with `crypto.sign` using scope `https://www.googleapis.com/auth/drive.readonly`, exchange it at `https://oauth2.googleapis.com/token`, then call `https://www.googleapis.com/drive/v3/files/<id>/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Use `redirect: 'error'` for Drive and token calls. For the public export, follow only redirects to hosts ending in `.googleusercontent.com` or `docs.google.com`. An HTML response or 401, 403 or 404 becomes "Paarvix cannot read this sheet: share it or make it public". A 403 with `exportSizeLimitExceeded` becomes "This sheet is too large for Google to export".

- [ ] **Step 4: Implement `SheetSyncService`.** `sync` holds an in-memory `Set` lock per source, and a second call returns "Sync already running". Success writes `lastSyncAt` and clears `lastSyncError`; failure keeps old data and writes `lastSyncError`. A 60-second `setInterval` starts in `onModuleInit`, syncs due sources one at a time, and is cleared in `onModuleDestroy`. Being driven by stored `lastSyncAt`, it resumes after a restart. `syncMinutes` below 15 is rejected.

- [ ] **Step 5: Add** `POST /datasources/:id/sync` (Admin). `create` for `gsheet` runs the first sync and deletes the source if it fails, returning the error.

- [ ] **Step 6: Verify** with one test public sheet and one service-account sheet. Key values must not appear in API responses or logs.

- [ ] **Step 7: Commit** with `feat(connectors): add Google Sheets sync`.

### Task 7: Data Sources screen

**Files:**
- Modify: `apps/web/src/app/features/datasources/datasources.component.ts`, `apps/web/public/assets/i18n/en.json`, `ta.json`
- Create: `apps/web/src/app/features/datasources/source-preview.component.ts`, `source-form.component.ts`

**Interfaces:**
- Consumes: routes from Tasks 2, 5 and 6.

- [ ] **Step 1: Build `source-form`:** a chooser for Excel, Google Sheet, MySQL and PostgreSQL. Excel has a file picker with upload progress. Sheet has link, optional private key and refresh interval. Databases have the host form plus a reminder to use a read-only user. Use typed forms, Signals and OnPush.

- [ ] **Step 2: Build `source-preview`:** tables and columns with types, and the first 50 rows through `POST /:id/data`. It is a real `<table>`, scrolls inside its container at phone width, and shows an empty state when there are no tables.

- [ ] **Step 3: Update the list:** type badge, "last synced" time, `lastSyncError` in plain words, and Sync or Replace file actions. Errors show the server's message.

- [ ] **Step 4: Add strings** to `en.json` and `ta.json`, with no hard-coded text.

- [ ] **Step 5: Verify** with `npm run build:web`. Start both apps and complete each source flow in a browser at desktop and 375 px width.

- [ ] **Step 6: Commit** with `feat(web): connect Excel, Sheets and MySQL from Data Sources`.

### Task 8: User documentation

**Files:**
- Create: `docs/guide/getting-started.md`, `docs/guide/connecting-data.md`, `docs/guide/sectors-and-customising.md`, `docs/roadmap.md`, `docs/adr/0001-import-spreadsheets-into-postgres.md`
- Modify: `README.md`, `CHANGELOG.md`, `docs/college-data-source.md`

Docs say only what works today. Anything planned is labelled by stage. Each guide is written for a non-technical admin, with no jargon.

- [ ] **Step 1: `getting-started.md`:** install, first admin, connect a source, who can do what by role, and what to do if something fails.

- [ ] **Step 2: `connecting-data.md`:** one section each for Excel, public Sheets, private Sheets (creating a service account and sharing the sheet), MySQL and PostgreSQL. Include creating a read-only user, limits, how data refreshes, "last synced", common error messages with fixes, and a warning to treat student and patient files as sensitive.

- [ ] **Step 3: `sectors-and-customising.md`:** core, packs and customer setup, the sector examples, the customisation levels, and the rule that a pack gives each customer their own copy. Mark packs and builder as planned.

- [ ] **Step 4: `roadmap.md`:** stages 1 to 5 with what each gives users, status, and the `prisma migrate deploy` task needed before the first paying client.

- [ ] **Step 5: ADR and CHANGELOG:** the ADR records Option A, the rejected DuckDB and per-query parsing options, and why spreadsheet sources have no raw SQL. Add the `CHANGELOG.md` entry, and link the guides from `README.md`.

- [ ] **Step 6: Commit** with `docs: add user guides, roadmap and import ADR`.

### Task 9: End-to-end verification

**Files:** none unless a defect is found.

- [ ] **Step 1: Run** `npx jest` in `apps/api`, then `npm run build:api` and `npm run build:web`. All must pass.

- [ ] **Step 2: Docker lite mode.** Run `npm run docker:up` and repeat one Excel upload. Check idle memory with `docker stats`: API under 512 MB. Also import a generated 50 MB file and confirm the API survives without being killed.

- [ ] **Step 3: REA and Chrome checks on our own build only.** Capture Data Sources screenshots at desktop and phone width. Run bundle analysis on `apps/web/dist` and confirm initial JS is under 400 KB gzipped. Report any overage, as the existing app may already exceed it.

- [ ] **Step 4: Permission check.** As a Viewer, `schema`, `data`, `query`, `upload` and `sync` all return 403. As an Editor, `upload`, `sync` and delete return 403.

- [ ] **Step 5: Scans.** Run the repo's CI secret and personal-data checks plus `npm audit`, and check `git status` for stray files, such as `.xlsx` fixtures or `graphify-out/`.

- [ ] **Step 6: Run** `superpowers:requesting-code-review` on the branch and fix confirmed findings.
