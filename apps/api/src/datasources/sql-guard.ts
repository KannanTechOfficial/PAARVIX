/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import { Parser } from 'node-sql-parser';

export type SqlDialect = 'postgres' | 'mysql';

const parser = new Parser();
const MAX_SQL_LENGTH = 100_000;

/** Statement keywords that can change data or the server, wherever they appear in the tree. */
const WRITE_TYPES = new Set(['insert', 'update', 'delete', 'replace', 'create', 'drop', 'alter', 'truncate', 'grant', 'revoke', 'merge', 'call', 'exec', 'set', 'lock', 'unlock', 'use', 'load', 'copy']);

/** Walks the whole tree, so a write hidden inside a WITH or a subquery is found too. */
function containsWrite(node: unknown, depth = 0): boolean {
  if (depth > 200 || node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => containsWrite(n, depth + 1));
  const n = node as Record<string, unknown>;
  if (typeof n.type === 'string' && WRITE_TYPES.has(n.type.toLowerCase())) return true;
  // SELECT ... INTO creates a table.
  if (n.type === 'select' && n.into && (n.into as { expr?: unknown }).expr) return true;
  return Object.values(n).some((v) => containsWrite(v, depth + 1));
}

/**
 * Accepts exactly one read-only SELECT (including WITH). Fails closed: text the parser
 * cannot read is refused, never waved through. The read-only transaction stays the final barrier.
 */
export function assertReadOnlySql(sql: string, dialect: SqlDialect = 'postgres'): string {
  const text = typeof sql === 'string' ? sql.trim().replace(/;\s*$/, '') : '';
  if (!text) throw new BadRequestException('Write a SELECT query first');
  if (text.length > MAX_SQL_LENGTH) throw new BadRequestException('This query is too long');
  if (!/^(select|with)\b/i.test(text) || text.includes(';')) {
    throw new BadRequestException('Only a single SELECT or WITH statement is allowed');
  }

  // The MySQL connector also serves MariaDB, so MariaDB's grammar is tried when MySQL's cannot read the text.
  // Each attempt is a full parse; text neither grammar can read is still refused.
  const grammars = dialect === 'mysql' ? ['MySQL', 'MariaDB'] : ['PostgresQL'];
  let ast: unknown;
  let lastError: unknown;
  for (const database of grammars) {
    try {
      ast = parser.astify(text, { database });
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (ast === undefined) {
    const e = lastError;
    const where = (e as { location?: { start?: { line?: number; column?: number } } }).location?.start;
    const at = where?.line ? ` (line ${where.line}, column ${where.column})` : '';
    throw new BadRequestException(`Paarvix could not read this query${at}. Check the SQL, or use the builder.`);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length !== 1 || (statements[0] as { type?: string })?.type !== 'select') {
    throw new BadRequestException('Only a single SELECT or WITH statement is allowed');
  }
  if (containsWrite(statements[0])) throw new BadRequestException('This query would change data, so it is not allowed');
  return text;
}
