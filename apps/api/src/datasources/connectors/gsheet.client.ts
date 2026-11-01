/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { BadRequestException } from '@nestjs/common';
import { createPrivateKey, sign } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** The token endpoint is fixed. A key file's own `token_uri` is ignored, so it cannot redirect the signed token. */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TOKEN_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const MAX_KEY_CHARS = 20_000;

export const NOT_READABLE = 'Paarvix cannot read this sheet: share it or make it public';
const TOO_LARGE = 'This sheet is too large for Google to export';
const TOO_BIG_FILE = 'This sheet is larger than 50 MB';
const BAD_KEY = 'The service account key is not valid';

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

type Fetch = typeof fetch;
export interface DownloadOptions {
  fetch?: Fetch;
  maxBytes?: number;
}

/** Extracts the spreadsheet ID from a docs.google.com link. Any other host or shape is refused. */
export function parseSheetId(link: string): string {
  const bad = () => new BadRequestException('Paste the link of a Google Sheet (docs.google.com/spreadsheets/d/...)');
  if (typeof link !== 'string' || link.length > 2000) throw bad();
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    throw bad();
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || url.port || url.username || url.password) throw bad();
  // Real IDs are about 44 characters. The minimum keeps `/spreadsheets/d/e/...` (published links) out.
  const m = /^\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{10,})(?:\/|$)/.exec(url.pathname);
  if (!m) throw bad();
  return m[1];
}

/** Checks a pasted service account key and returns only the two fields Paarvix uses, as JSON text. */
export function validateServiceAccount(text: unknown): string {
  if (typeof text !== 'string' || text.length > MAX_KEY_CHARS) throw new BadRequestException(BAD_KEY);
  let key: Record<string, unknown>;
  try {
    key = JSON.parse(text);
  } catch {
    throw new BadRequestException('The service account key is not valid JSON');
  }
  const email = key?.client_email;
  const pem = key?.private_key;
  if (typeof email !== 'string' || !email || email.length > 320 || typeof pem !== 'string' || !pem) throw new BadRequestException(BAD_KEY);
  try {
    if (createPrivateKey(pem).asymmetricKeyType !== 'rsa') throw new Error('not rsa');
  } catch {
    throw new BadRequestException(BAD_KEY);
  }
  return JSON.stringify({ client_email: email, private_key: pem });
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');

/** RS256 JWT for Google's service account flow. */
export function signJwt(key: ServiceAccountKey, nowSeconds: number): string {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  );
  const data = `${head}.${claims}`;
  return `${data}.${b64url(sign('RSA-SHA256', Buffer.from(data), key.private_key))}`;
}

function hostAllowed(url: URL, hosts: (string | RegExp)[]): boolean {
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
  return hosts.some((h) => (typeof h === 'string' ? url.hostname === h : h.test(url.hostname)));
}

/**
 * One request that follows redirects by hand: at most `maxRedirects`, https only, and every hop must be on an allowed host.
 * Request headers go to the first hop only.
 */
async function request(
  start: string,
  init: RequestInit,
  hosts: (string | RegExp)[],
  maxRedirects: number,
  doFetch: Fetch,
): Promise<Response> {
  let url = new URL(start);
  for (let hop = 0; ; hop++) {
    const res = await doFetch(url, { ...(hop === 0 ? init : { signal: init.signal }), redirect: 'manual' });
    if (res.status < 300 || res.status > 399) return res;
    await res.body?.cancel().catch(() => undefined);
    const location = res.headers.get('location');
    let next: URL;
    try {
      if (!location) throw new Error('no location');
      next = new URL(location, url);
    } catch {
      throw new BadRequestException(NOT_READABLE);
    }
    if (!hostAllowed(next, hosts)) throw new BadRequestException(NOT_READABLE); // typically the sign-in page of a private sheet
    if (hop >= maxRedirects) throw new BadRequestException('Google redirected too many times');
    url = next;
  }
}

/** Network failures say nothing useful and may quote the URL, so only a plain message is raised. */
function netError(e: unknown): Error {
  if (e instanceof BadRequestException) return e;
  const name = (e as Error)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return new BadRequestException('Google took too long to respond');
  return new BadRequestException('Could not reach Google');
}

async function failure(res: Response): Promise<Error> {
  let body = '';
  try {
    // Reads at most 64 KB; the body is only used to tell one 403 from another.
    const chunks: Buffer[] = [];
    let size = 0;
    if (res.body) {
      for await (const chunk of Readable.fromWeb(res.body as never)) {
        chunks.push(chunk as Buffer);
        size += (chunk as Buffer).length;
        if (size >= 65536) break;
      }
    }
    body = Buffer.concat(chunks).subarray(0, 65536).toString('utf8');
    await res.body?.cancel().catch(() => undefined);
  } catch {
    /* an unreadable body only means the generic message is used */
  }
  if (res.status === 403 && body.includes('exportSizeLimitExceeded')) return new BadRequestException(TOO_LARGE);
  if (res.status === 401 || res.status === 403 || res.status === 404) return new BadRequestException(NOT_READABLE);
  return new BadRequestException(`Google could not export this sheet (HTTP ${res.status})`);
}

async function accessToken(key: ServiceAccountKey, doFetch: Fetch): Promise<string> {
  let jwt: string;
  try {
    jwt = signJwt(key, Math.floor(Date.now() / 1000));
  } catch {
    throw new BadRequestException(BAD_KEY);
  }
  const res = await request(
    TOKEN_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    },
    ['oauth2.googleapis.com'],
    0,
    doFetch,
  );
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new BadRequestException('Google rejected the service account key');
  }
  const token = ((await res.json()) as { access_token?: unknown }).access_token;
  if (typeof token !== 'string' || !token) throw new BadRequestException('Google rejected the service account key');
  return token;
}

/** Counts bytes and stops the download past the limit. */
function limit(max: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      cb(seen > max ? new BadRequestException(TOO_BIG_FILE) : null, chunk);
    },
  });
}

/**
 * Downloads a sheet as .xlsx to `destPath`. Requests go only to fixed Google hosts built from the validated ID.
 * Public sheets use the docs export. With a service account, the Drive export is used instead.
 */
export async function downloadSheet(
  spreadsheetId: string,
  serviceAccount: string | undefined,
  destPath: string,
  opts: DownloadOptions = {},
): Promise<void> {
  const doFetch = opts.fetch ?? fetch;
  if (!/^[a-zA-Z0-9_-]+$/.test(spreadsheetId)) throw new BadRequestException(NOT_READABLE);
  try {
    let res: Response;
    if (serviceAccount) {
      let key: ServiceAccountKey;
      try {
        key = JSON.parse(serviceAccount);
      } catch {
        throw new BadRequestException(BAD_KEY);
      }
      const token = await accessToken(key, doFetch);
      res = await request(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`,
        { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) },
        ['www.googleapis.com'],
        0,
        doFetch,
      );
    } else {
      res = await request(
        `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`,
        { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) },
        ['docs.google.com', /\.googleusercontent\.com$/],
        MAX_REDIRECTS,
        doFetch,
      );
    }
    if (!res.ok) throw await failure(res);
    if (!res.body) throw new BadRequestException(NOT_READABLE);
    await pipeline(Readable.fromWeb(res.body as never), limit(opts.maxBytes ?? MAX_DOWNLOAD_BYTES), createWriteStream(destPath));
    // A sign-in page arrives as HTML with status 200. An .xlsx is a zip.
    const f = await open(destPath, 'r');
    try {
      const head = Buffer.alloc(4);
      await f.read(head, 0, 4, 0);
      if (head.toString('latin1') !== 'PK\x03\x04') throw new BadRequestException(NOT_READABLE);
    } finally {
      await f.close();
    }
  } catch (e) {
    throw netError(e);
  }
}
