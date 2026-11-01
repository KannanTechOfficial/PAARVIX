/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

// Entry point of the import process. The parent forks it with a heap limit and sends one WorkerInput over IPC.
// It is a process, not a thread, on purpose: a V8 out-of-memory abort inside a worker thread takes the whole
// parent down (reproduced with a 127 MB shared-strings part and a 256 MB limit), but kills only a child process.
// See table-store.ts for the parent side.

import { BadRequestException } from '@nestjs/common';
import { Client } from 'pg';
import type { TableSchema } from '@paarvix/shared';
import { ImportFailure, runImport, sqlState, type ImportOptions } from './import-job';
import { UnsupportedReaderError } from './workbook';

export interface WorkerInput extends ImportOptions {
  connectionString: string;
  datasourceId: string;
  path: string;
}

/** What the parent learns about a failure. Driver text is never included: it can quote file content. */
export type WorkerError =
  | { kind: 'bad'; message: string }
  | { kind: 'failure' | 'unsupported'; message: string }
  | { kind: 'other'; sqlState?: string };

export type WorkerMessage = { ok: true; tables: TableSchema[] } | { ok: false; error: WorkerError };

function describe(e: unknown): WorkerError {
  if (e instanceof BadRequestException) return { kind: 'bad', message: e.message };
  if (e instanceof ImportFailure) return { kind: 'failure', message: e.message };
  if (e instanceof UnsupportedReaderError) return { kind: 'unsupported', message: e.message };
  return { kind: 'other', sqlState: sqlState(e) };
}

async function main(input: WorkerInput): Promise<WorkerMessage> {
  const client = new Client({ connectionString: input.connectionString, connectionTimeoutMillis: 10000 });
  client.on('error', () => undefined); // a dropped connection surfaces as a failed query
  try {
    return { ok: true, tables: await runImport(client, input.datasourceId, input.path, { limits: input.limits, workRoot: input.workRoot }) };
  } catch (e) {
    return { ok: false, error: describe(e) };
  }
}

if (process.send) {
  process.on('disconnect', () => process.exit(1)); // the parent is gone: nobody wants the result
  process.once('message', (input: WorkerInput) => {
    void main(input).then((m) => process.send!(m, () => process.exit(0)));
  });
}
